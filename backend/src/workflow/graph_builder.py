"""工作流图构建器——根据配置构建 LangGraph StateGraph。"""

import asyncio
import contextlib
import json
import os
import time
from collections.abc import Hashable
from typing import Any, cast

from langgraph.graph import END, StateGraph

from core.infra.logging_config import get_logger

from .models import NodeStrategy, WorkflowConfig, WorkflowState
from .node_factory import NodeFactory
from .router import Router

# 在重试入口节点前使 round_number 递增的合成节点。其名称在实践中
# 不可能与用户的 role_identifier 冲突。
_ROUND_NODE = "__round_increment__"

_HUMAN_VERDICT_KEY = "team:{run_id}:human_verdict"

logger = get_logger(__name__)


def _hitl_wait_timeout() -> float:
    """审批门控等待人工裁决的秒数（0 = 自动放行）。"""
    return float(os.environ.get("HITL_WAIT_TIMEOUT", "300"))


async def _read_human_verdict(r: Any, key: str) -> dict[str, Any] | None:
    """读取并解析 ``team:{run_id}:human_verdict``；缺失或无效时返回 None。"""
    try:
        raw = await r.get(key)
    except Exception:
        return None
    if raw is None:
        return None
    raw_s = raw.decode() if isinstance(raw, bytes) else raw
    try:
        verdict = json.loads(raw_s)
    except (json.JSONDecodeError, TypeError):
        return None
    if isinstance(verdict, dict) and "approved" in verdict:
        return verdict
    return None


async def _approval_route(
    state: WorkflowState,
    config: WorkflowConfig,
    entry_node: str,
    node_id: str,
    run_id: str = "",
) -> str:
    """为评审节点设门控——被驳回则重试入口节点，达到 max_rounds 则 END。

    HITL（阻塞）：当设置了 ``run_id`` 时，在 run 通道发布 ``approval_request``
    事件，使前端可弹出审批弹窗，然后：
      - 评审被驳回 → 阻塞至多 ``HITL_WAIT_TIMEOUT`` 秒（默认 300），轮询
        ``team:{run_id}:human_verdict``；人工裁决会覆盖自动裁决且仅消费一次
        （后续轮次重新请求）。超时则回退到自动裁决。
      - 评审通过 → 读取一次裁决键（非阻塞），使人工驳回仍可覆盖自动通过。
    Redis I/O 为尽力而为——任何失败都回退到自动裁决。

    返回供 ``add_conditional_edges`` 使用的路径键："retry" 回到迭代循环，
    "continue" 走向评审节点原本的下游目标，或在被驳回且 max_rounds 耗尽时
    返回 END（保留部分结果）。
    """
    rounds = int(state.get("round_number", 1) or 1)
    verdicts = state.get("verdicts", {}) or {}
    any_reject = any(not v.get("approved", True) for v in verdicts.values())

    if run_id:
        try:
            from broker import get_redis, publish_run_message

            key = _HUMAN_VERDICT_KEY.format(run_id=run_id)
            r = get_redis()
            await publish_run_message(
                run_id,
                {"type": "approval_request", "run_id": run_id, "node": node_id},
            )
            if any_reject:
                # 强阻塞：驳回必须经人工确认（或超时自动回退）。
                # 至少读一次：已存在的裁决立即消费；否则等到 deadline。
                deadline = time.monotonic() + _hitl_wait_timeout()
                while True:
                    verdict = await _read_human_verdict(r, key)
                    if verdict is not None:
                        # 一次性消费：后续轮次再驳回时重新请求人工。
                        with contextlib.suppress(Exception):
                            await r.delete(key)
                        any_reject = not bool(verdict["approved"])
                        break
                    if time.monotonic() >= deadline:
                        break
                    await asyncio.sleep(1.0)
            else:
                verdict = await _read_human_verdict(r, key)
                if verdict is not None:
                    any_reject = not bool(verdict["approved"])
        except Exception:
            logger.debug("HITL verdict check failed for run=%s", run_id, exc_info=True)

    if any_reject and rounds >= config.max_rounds:
        return END
    if any_reject:
        return "retry"
    return "continue"


class GraphBuilder:
    def __init__(
        self,
        node_factory: NodeFactory,
        router: Router,
        checkpointer: Any | None = None,
        llm: Any | None = None,
        run_id: str = "",
    ):
        self.node_factory = node_factory
        self.router = router
        self.checkpointer = checkpointer
        self.llm = llm
        self.run_id = run_id

    def build(self, config: WorkflowConfig) -> StateGraph[Any]:
        workflow = StateGraph(WorkflowState)
        sorted_nodes = sorted(config.nodes, key=lambda n: n.order)
        entry_node = sorted_nodes[0].role_identifier if sorted_nodes else None
        has_reviewer = any(n.strategy == NodeStrategy.REVIEWER for n in sorted_nodes)

        for node in sorted_nodes:
            node_fn = self.node_factory.create(node)
            workflow.add_node(node.role_identifier, cast(Any, node_fn))

        if has_reviewer and entry_node:
            def _increment_round(state: WorkflowState) -> dict[str, int]:
                return {"round_number": int(state.get("round_number", 1) or 1) + 1}

            workflow.add_node(_ROUND_NODE, _increment_round)
            workflow.add_edge(_ROUND_NODE, entry_node)

        if entry_node:
            workflow.set_entry_point(entry_node)

        for node in sorted_nodes:
            outgoing = [e for e in config.edges if e.from_node_id == node.role_identifier]
            if node.strategy == NodeStrategy.REVIEWER:
                self._add_reviewer_gate(workflow, config, node, outgoing, entry_node)
                continue
            self._add_node_edges(workflow, config, node, outgoing)

        return cast(StateGraph[Any], workflow.compile(checkpointer=self.checkpointer))

    def _add_reviewer_gate(
        self,
        workflow: StateGraph[Any],
        config: WorkflowConfig,
        node: Any,
        outgoing: list[Any],
        entry_node: str | None,
    ) -> None:
        """用审批门控替换评审节点的出边。"""
        real = [e for e in outgoing if e.to_node_id != "END"]
        unconditional = [e for e in real if not e.condition_key]
        # 通过 -> 走向评审节点原本的下游目标；跳过回到入口节点的自环
        # （重试由门控负责）并回退到 END。
        post = next((e.to_node_id for e in unconditional if e.to_node_id != entry_node), END)
        # HITL 钩子：门控发布 approval_request 事件并读取由
        # routers/team_runs.py 写入的 team:{run_id}:human_verdict 键——见
        # _approval_route。run_id 可选；没有它时门控仅自动执行。
        async def _hitl_path(
            state: WorkflowState,
            cfg: WorkflowConfig = config,
            en: str | None = entry_node,
            nid: str = node.role_identifier,
        ) -> str:
            return await _approval_route(state, cfg, en or "", nid, self.run_id)

        workflow.add_conditional_edges(
            node.role_identifier,
            _hitl_path,
            {"retry": _ROUND_NODE, "continue": post, END: END},
        )

    def _add_node_edges(
        self,
        workflow: StateGraph[Any],
        config: WorkflowConfig,
        node: Any,
        outgoing: list[Any],
    ) -> None:
        if not outgoing:
            workflow.add_edge(node.role_identifier, END)
            return

        real_edges = [e for e in outgoing if e.to_node_id != "END"]
        end_edges = [e for e in outgoing if e.to_node_id == "END"]

        for end_edge in end_edges:
            if end_edge.condition_key:
                end_map = {kw.strip(): END for kw in end_edge.condition_key.split("|") if kw.strip()}
                end_map["*"] = END
                workflow.add_conditional_edges(
                    node.role_identifier,
                    lambda s, nid=node.role_identifier: END,
                    cast(dict[Hashable, str], end_map),
                )
            else:
                workflow.add_edge(node.role_identifier, END)

        conditions = [e for e in real_edges if e.condition_key]
        unconditional = [e for e in real_edges if not e.condition_key]

        if conditions:
            if self.llm is not None and any(e.routing_mode == "llm" for e in conditions):
                targets = {e.to_node_id for e in conditions} | {e.to_node_id for e in unconditional}
                mapping: dict[str, str] = {t: t for t in targets}
                mapping[END] = END

                async def _llm_path(state: WorkflowState, nid: str = node.role_identifier) -> str:
                    return await self._route_llm(config.edges, state, nid)

                workflow.add_conditional_edges(
                    node.role_identifier,
                    _llm_path,
                    cast(dict[Hashable, str], mapping),
                )
            else:
                workflow.add_conditional_edges(
                    node.role_identifier,
                    lambda state, nid=node.role_identifier: self.router.resolve(config.edges, state, nid),
                    cast(dict[Hashable, str], self._build_edge_map(outgoing)),
                )
        elif len(unconditional) == 1:
            workflow.add_edge(node.role_identifier, unconditional[0].to_node_id)
        elif len(unconditional) > 1:
            uncond_targets = [e.to_node_id for e in unconditional]
            workflow.add_conditional_edges(
                node.role_identifier,
                lambda state, tgt=uncond_targets: tgt,
                {t: t for t in uncond_targets},
            )

    async def _route_llm(self, edges: list[Any], state: WorkflowState, current_node_id: str) -> str:
        return await self.router.resolve_llm(edges, state, current_node_id, self.llm)

    def _build_edge_map(self, edges: list[Any]) -> dict[str, str]:
        edge_map: dict[str, str] = {}
        for e in edges:
            if e.condition_key:
                for kw in e.condition_key.split("|"):
                    kw = kw.strip()
                    if kw and kw not in edge_map:
                        edge_map[kw] = e.to_node_id
        default = next((e for e in edges if e.is_default), None)
        if default:
            edge_map["*"] = default.to_node_id
        else:
            edge_map["*"] = END
        return edge_map
