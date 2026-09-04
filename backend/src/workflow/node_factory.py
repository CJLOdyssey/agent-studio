"""节点工厂——从工作流定义创建可调用的 LangGraph 节点。"""

import contextlib
import json
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, Protocol

from cost.llm_span_recorder import close_node_span, open_node_span, record_llm_span, summarize_body
from cost.token_tracker import get_token_tracker
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage

from broker import publish_run_message
from services.thinking_chain import format_result_preview, get_tool_prefix
from services.tool_config import ToolConfig, build_tool_definition
from streaming.llm_stream import (
    build_tool_calls_list,
    convert_messages_to_api,
    stream_llm_response,
)

from .models import WorkflowNode, WorkflowState
from .quality_validator import QualityValidator, create_default_validator
from .strategy_registry import registry

# 限制单节点内工具调用轮数，避免模型异常时陷入死循环。
_MAX_TOOL_ROUNDS = 8


def _validate_json(text: str, schema: dict[str, Any]) -> bool:
    """检查 *text* 能否解析为 JSON 且包含所有 ``required`` schema 字段。"""
    data: Any = None
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                data = json.loads(text[start : end + 1])
            except (json.JSONDecodeError, ValueError):
                return False
        else:
            return False
    if not isinstance(data, dict):
        return False
    required = schema.get("required", [])
    return all(key in data for key in required)


class LLMConfig(Protocol):
    """LLM 配置的协议——任何具备这些属性的对象均可使用。

    实际中 ChatOpenAI 的字段为 Optional（temperature/max_tokens 默认为 None），
    因此该 Protocol 反映这一现实。工厂在调用处使用带默认值的 getattr() 处理
    None 值。
    """

    openai_api_key: Any
    openai_api_base: str | None
    model_name: str
    temperature: float | None
    max_tokens: int | None


class NodeFactory:
    """从工作流定义创建可调用 LangGraph 节点的工厂。"""

    def __init__(
        self,
        llm: LLMConfig,
        agent_prompts: dict[str, str],
        tools: list[ToolConfig] | None = None,
        node_tools: dict[str, list[ToolConfig]] | None = None,
        run_id: str = "",
        attachment_context: str = "",
        team_id: str | None = None,
        user_id: str | None = None,
        key_id: str | None = None,
        quality_validator: QualityValidator | None = None,
    ):
        """使用 LLM 配置、提示词与可选工具初始化节点工厂。

        ``tools`` 作为回退应用于每个节点；``node_tools`` 将 ``role_identifier``
        映射到其专属的 ToolConfig 列表，优先级更高。
        ``attachment_context`` 作为 SystemMessage 注入到角色系统提示词之后
        （与 agent 流水线一致），使每个节点都能看到绑定到本次 run 的文件。
        ``quality_validator`` 在输出传给下游节点前对其进行校验。
        ``team_id``/``user_id``/``key_id`` 是转发进每个节点成本记录
        （token_usage）的归属标记，便于按这些维度过滤成本。
        """
        self.llm = llm
        self.agent_prompts = agent_prompts
        self.tools = tools or []
        self.node_tools = node_tools or {}
        self.run_id = run_id
        self.attachment_context = attachment_context
        self.team_id = team_id
        self.user_id = user_id
        self.key_id = key_id
        self.quality_validator = quality_validator or create_default_validator()

    def _build_request(
        self,
        api_messages: list[dict[str, Any]],
        tool_definitions: list[dict[str, Any]] | None = None,
    ) -> tuple[str, dict[str, Any], dict[str, Any]]:
        """构建 LLM 流式 API 的 HTTP 请求。"""
        raw_key: Any = getattr(self.llm, "openai_api_key", "")
        actual_key = raw_key.get_secret_value() if hasattr(raw_key, "get_secret_value") else str(raw_key)
        base = (getattr(self.llm, "openai_api_base", None) or "https://api.deepseek.com").rstrip("/")
        url = f"{base}/chat/completions"
        headers = {"Authorization": f"Bearer {actual_key}", "Content-Type": "application/json"}
        body: dict[str, Any] = {
            "model": getattr(self.llm, "model_name", "deepseek-chat"),
            "messages": api_messages,
            "stream": True,
            "stream_options": {"include_usage": True},
            "temperature": getattr(self.llm, "temperature", 0.7),
            "max_tokens": getattr(self.llm, "max_tokens", None),
        }
        if tool_definitions:
            body["tools"] = tool_definitions
            body["tool_choice"] = "auto"
        elif "deepseek" in (base.lower() + body["model"].lower()):
            # DeepSeek 原生思考模式与工具调用冲突——
            # 仅在未绑定工具时启用（与 build_llm_request_body 一致）。
            body["thinking"] = {"type": "enabled"}
        return url, headers, body

    def _node_tool_configs(self, node: WorkflowNode) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """为节点解析并注册工具定义与包装器。

        返回 ``(definitions, tool_map)``，其中 ``tool_map`` 将 API 工具名映射到
        ``_ToolWrapper``。节点专属配置优先于回退的 ``tools`` 列表。
        """
        configs = self.node_tools.get(node.role_identifier)
        if configs is None:
            configs = self.tools
        if not configs:
            return [], {}
        definitions: list[dict[str, Any]] = []
        tool_map: dict[str, Any] = {}
        for tc in configs:
            api_name, wrapper, definition = build_tool_definition(tc, llm=self.llm)
            if self.run_id:
                wrapper.set_run_id(self.run_id)
            tool_map[api_name] = wrapper
            definitions.append(definition)
        return definitions, tool_map

    def create(self, node: WorkflowNode) -> Callable[[WorkflowState], dict[str, Any] | Awaitable[dict[str, Any]]]:
        """为工作流节点创建可调用的节点函数。"""
        strategy = registry.get(node.strategy.value)
        system_prompt = self.agent_prompts.get(node.role_identifier, "")
        run_id = self.run_id
        tool_definitions, tool_map = self._node_tool_configs(node)

        async def node_fn(state: WorkflowState) -> dict[str, Any]:
            context = strategy.build_prompt_context(state, node)
            messages: list[BaseMessage] = [SystemMessage(content=system_prompt)]
            if self.attachment_context:
                messages.append(SystemMessage(content=self.attachment_context))
            messages.append(HumanMessage(content=context))
            api_msgs = convert_messages_to_api(messages)

            async def cb(ev: dict[str, Any]) -> Any:
                if not run_id:
                    return
                chunk = ev.get("data", {}).get("content", "")
                if not chunk:
                    return
                mt = "thinking_stream" if ev.get("event") == "on_custom_thinking" else "stream"
                with contextlib.suppress(Exception):
                    await publish_run_message(
                        run_id,
                        {"type": mt, "agent_name": node.role_identifier, "content": chunk},
                    )

            full_content = ""
            tool_round_exhausted = False
            total_usage = {"prompt_tokens": 0, "completion_tokens": 0}

            # ── 追踪（粒度 B）：为该工作流节点打开一个 node span ──
            _node_start = datetime.now(UTC)
            _node_span_id = ""
            _model_name = getattr(self.llm, "model_name", "unknown")
            if run_id:
                try:
                    _node_span_id = await open_node_span(
                        run_id=run_id,
                        session_id=getattr(self, "session_id", None),
                        node_id=node.role_identifier,
                        span_type="node",
                        model=_model_name,
                        team_id=self.team_id,
                        user_id=self.user_id,
                        key_id=self.key_id,
                    )
                except Exception:  # noqa: BLE001
                    _node_span_id = ""

            for _ in range(_MAX_TOOL_ROUNDS + 1):
                _round_start = datetime.now(UTC)
                url, headers, body = self._build_request(api_msgs, tool_definitions)
                content_chunks, _, tool_calls_map, _, usage_info = await stream_llm_response(
                    url, headers, body, cb, tool_definitions
                )
                # 累加 token 用量
                if usage_info:
                    total_usage["prompt_tokens"] += usage_info.get("prompt_tokens", 0)
                    total_usage["completion_tokens"] += usage_info.get("completion_tokens", 0)
                full_content = "".join(content_chunks)
                tool_calls = build_tool_calls_list(tool_calls_map or {})
                # ── 追踪：将本次 LLM 调用记录为 node span 的子 span ──
                if _node_span_id:
                    try:
                        _pt = int((usage_info or {}).get("prompt_tokens") or 0)
                        _ct = int((usage_info or {}).get("completion_tokens") or 0)
                        await record_llm_span(
                            run_id=run_id,
                            session_id=getattr(self, "session_id", None),
                            node_id=node.role_identifier,
                            model=_model_name,
                            prompt_tokens=_pt,
                            completion_tokens=_ct,
                            duration_ms=int((datetime.now(UTC) - _round_start).total_seconds() * 1000),
                            status="success",
                            parent_span_id=_node_span_id,
                            input_snapshot=summarize_body(body),
                            output_snapshot=full_content[:4000],
                            team_id=self.team_id,
                            user_id=self.user_id,
                            key_id=self.key_id,
                        )
                    except Exception:  # noqa: BLE001
                        pass
                if not tool_calls:
                    break

                messages.append(
                    AIMessage(
                        content=full_content,
                        tool_calls=[{"name": tc["name"], "args": tc["args"], "id": tc["id"]} for tc in tool_calls],
                    )
                )
                tool_messages = []
                for tc in tool_calls:
                    name = tc.get("name", "")
                    args = tc.get("args", {}) or {}
                    fn = tool_map.get(name)
                    prefix = get_tool_prefix(name)
                    args_preview = json.dumps(args, ensure_ascii=False)[:200]
                    await cb({"event": "on_custom_thinking", "data": {"content": f"{prefix} {name}({args_preview})"}})
                    _tool_start = datetime.now(UTC)
                    if fn:
                        try:
                            result = await fn.invoke(args)
                        except Exception as exc:
                            result = f"Error: {exc}"
                    else:
                        result = f"Unknown tool: {name}"
                    if _node_span_id:
                        with contextlib.suppress(Exception):
                            await record_llm_span(
                                run_id=run_id,
                                session_id=getattr(self, "session_id", None),
                                node_id=f"{node.role_identifier}.{name}",
                                model=_model_name,
                                prompt_tokens=0,
                                completion_tokens=0,
                                duration_ms=int((datetime.now(UTC) - _tool_start).total_seconds() * 1000),
                                status="success",
                                parent_span_id=_node_span_id,
                                input_snapshot=summarize_body({"tool": name, "args": args}),
                                output_snapshot=str(result or "")[:4000],
                                team_id=self.team_id,
                                user_id=self.user_id,
                                key_id=self.key_id,
                            )
                    await cb(
                        {
                            "event": "on_custom_thinking",
                            "data": {"content": f"[result] {name} → {format_result_preview(result)}"},
                        }
                    )
                    tool_messages.append(
                        ToolMessage(
                            content=str(result or ""),
                            tool_call_id=tc.get("id", ""),
                            name=name,
                        )
                    )
                messages.extend(tool_messages)
                api_msgs = convert_messages_to_api(messages)
            else:
                tool_round_exhausted = True

            if tool_round_exhausted:
                # 每轮工具调用都返回了 tool_calls——追加的 ToolMessages
                # 不会再次发送，因此节点输出可能不完整或为空。
                # 通过思考链（[info] 节点）向用户提示。
                await cb(
                    {
                        "event": "on_custom_thinking",
                        "data": {
                            "content": (f"[info] 工具调用轮数已达上限（{_MAX_TOOL_ROUNDS + 1} 轮），本轮输出可能不完整")
                        },
                    }
                )

            schema = getattr(strategy, "output_schema", None)
            if schema:
                for _ in range(2):
                    if _validate_json(full_content, schema):
                        break
                    messages.append(AIMessage(content=full_content))
                    messages.append(HumanMessage(content="输出不符合 JSON Schema，请重试（必须含 required 字段）"))
                    api_msgs = convert_messages_to_api(messages)
                    url, headers, body = self._build_request(api_msgs, tool_definitions)
                    chunks, _, _, _, retry_usage = await stream_llm_response(url, headers, body, cb, tool_definitions)
                    if retry_usage:
                        total_usage["prompt_tokens"] += retry_usage.get("prompt_tokens", 0)
                        total_usage["completion_tokens"] += retry_usage.get("completion_tokens", 0)
                    full_content = "".join(chunks)

            # ── 追踪：以聚合指标关闭 node span ──
            if _node_span_id:
                with contextlib.suppress(Exception):
                    await close_node_span(
                        _node_span_id,
                        prompt_tokens=total_usage["prompt_tokens"],
                        completion_tokens=total_usage["completion_tokens"],
                        cost_usd=0.0,
                        duration_ms=int((datetime.now(UTC) - _node_start).total_seconds() * 1000),
                        status="success",
                        model=_model_name,
                    )

            # 将 token 用量写入数据库
            if run_id and total_usage["prompt_tokens"] > 0:
                try:
                    tracker = get_token_tracker()
                    model_name = getattr(self.llm, "model_name", "unknown")
                    await tracker.record_usage(
                        run_id=run_id,
                        node_id=node.role_identifier,
                        model=model_name,
                        prompt_tokens=total_usage["prompt_tokens"],
                        completion_tokens=total_usage["completion_tokens"],
                        team_id=self.team_id,
                        user_id=self.user_id,
                        key_id=self.key_id,
                    )
                except Exception as exc:
                    # token 用量记录失败不应中断工作流
                    import logging

                    logging.getLogger(__name__).warning(f"Failed to record token usage: {exc}")

            # 质量校验——在传给下游节点前校验输出
            validation_meta: dict[str, Any] | None = None
            if self.quality_validator:
                validation_result = self.quality_validator.validate(full_content)
                if not validation_result.passed:
                    # 记录校验失败，但以降级输出继续
                    import logging

                    logging.getLogger(__name__).warning(
                        f"Node {node.role_identifier} output validation failed: "
                        f"{validation_result.message} (score: {validation_result.score:.2f})"
                    )
                    validation_meta = {
                        "passed": False,
                        "message": validation_result.message,
                        "score": validation_result.score,
                    }

            result = strategy.process_output(state, node, full_content)
            if validation_meta is not None:
                result.setdefault("metadata", {})["validation"] = validation_meta
            result["messages"] = state.get("messages", []) + [AIMessage(content=full_content)]
            return result

        return node_fn
