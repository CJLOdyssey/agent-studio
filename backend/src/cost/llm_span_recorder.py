"""LLM span 记录器（粒度 B——真正的父子树）。

一个工作流节点轮次（``SingleAgentGraph`` 的 ReAct 轮或一次 team ``node_fn``
执行）会开启一个 **node span**（span_type="node"，立即以已知 id 插入）。
该轮内的每次 LLM 调用都记为 **child span**（span_type="llm"），其
``parent_span_id`` 即当前开启的 node span id。轮次结束时 node span 会以
其子 span 聚合出的 tokens/cost/duration 更新，形成一棵以
``project_runs.id`` 为根的 Langfuse 风格 ``node → llm`` 树。

- 载荷为有界摘要（绝不保存完整对话）。
- 所有写入 fail-open：可观测性错误绝不中断 LLM 调用。
- node 与 child span 通过显式 id 关联（不使用跨任务 contextvars）。
"""


from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, update

from core.infra.database import get_session_factory
from cost.token_tracker import calculate_cost
from orm.llm_span import LLMSpanDB

logger = logging.getLogger(__name__)

_PAYLOAD_LIMIT = 4000


def _truncate(text: str | None, limit: int = _PAYLOAD_LIMIT) -> str | None:
    if not text:
        return None
    text = text.strip()
    return text if len(text) <= limit else text[:limit] + "\n…[截断]"


def summarize_body(body: dict[str, Any] | None, limit: int = _PAYLOAD_LIMIT) -> str | None:
    """请求体的有界 JSON 快照（messages + model）。"""
    if not body:
        return None
    try:
        return _truncate(json.dumps(body, ensure_ascii=False)[:limit], limit)
    except Exception:
        return None


async def open_node_span(
    *,
    run_id: str,
    session_id: str | None,
    node_id: str,
    span_type: str = "node",
    model: str = "",
    team_id: str | None = None,
    user_id: str | None = None,
    key_id: str | None = None,
) -> str:
    """开启一个 node span 并返回其 id（子 span 以其为 parent）。"""
    span_id = str(uuid4())
    try:
        factory = get_session_factory()
        async with factory() as session:
            session.add(
                LLMSpanDB(
                    id=span_id,
                    run_id=run_id,
                    session_id=session_id,
                    parent_span_id=None,
                    team_id=team_id,
                    user_id=user_id,
                    key_id=key_id,
                    span_type=span_type,
                    node_id=node_id,
                    model=model,
                    prompt_tokens=0,
                    completion_tokens=0,
                    total_tokens=0,
                    cost_usd=0.0,
                    duration_ms=0,
                    status="running",
                    created_at=datetime.now(UTC),
                )
            )
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.warning("Failed to open node span", exc_info=True)
    return span_id


async def close_node_span(
    span_id: str,
    *,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    duration_ms: int,
    status: str = "success",
    error: str | None = None,
    model: str = "",
    input_snapshot: str | None = None,
    output_snapshot: str | None = None,
) -> None:
    """用子 span 聚合的指标终结一个 node span。

    根 agent/chat span 通常不携带输入/输出文本（由其 LLM 子 span 承担）。
    对于单 span trace（未记录 LLM 子 span）而言，详情展开器无内容可展示，
    因此大厂 UI 仍在此展示该 run 真实的首条用户输入与最终输出。调用方以
    有界摘要形式传入。
    """
    try:
        total = int(prompt_tokens) + int(completion_tokens)
        factory = get_session_factory()
        async with factory() as session:
            await session.execute(
                update(LLMSpanDB)
                .where(LLMSpanDB.id == span_id)
                .values(
                    model=model,
                    prompt_tokens=int(prompt_tokens),
                    completion_tokens=int(completion_tokens),
                    total_tokens=total,
                    cost_usd=float(cost_usd or 0.0),
                    duration_ms=int(duration_ms),
                    status=status,
                    error=_truncate(error, 2000),
                    input_snapshot=_truncate(input_snapshot),
                    output_snapshot=_truncate(output_snapshot),
                )
            )
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.warning("Failed to close node span %s", span_id, exc_info=True)


async def record_llm_span(
    *,
    run_id: str,
    session_id: str | None,
    node_id: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    duration_ms: int,
    status: str,
    parent_span_id: str | None,
    input_snapshot: str | None = None,
    output_snapshot: str | None = None,
    error: str | None = None,
    team_id: str | None = None,
    user_id: str | None = None,
    key_id: str | None = None,
    cost_usd: float | None = None,
) -> None:
    """在 ``parent_span_id`` 下持久化一个 LLM 子 span。fail-open。"""
    try:
        total = int(prompt_tokens) + int(completion_tokens)
        final_cost = (
            float(cost_usd)
            if cost_usd is not None
            else calculate_cost(model, int(prompt_tokens), int(completion_tokens))
        )
        factory = get_session_factory()
        async with factory() as session:
            session.add(
                LLMSpanDB(
                    run_id=run_id,
                    session_id=session_id,
                    parent_span_id=parent_span_id,
                    team_id=team_id,
                    user_id=user_id,
                    key_id=key_id,
                    span_type="llm",
                    node_id=node_id,
                    model=model,
                    prompt_tokens=int(prompt_tokens),
                    completion_tokens=int(completion_tokens),
                    total_tokens=total,
                    cost_usd=final_cost,
                    duration_ms=int(duration_ms),
                    status=status,
                    error=_truncate(error, 2000),
                    input_snapshot=input_snapshot,
                    output_snapshot=_truncate(output_snapshot),
                )
            )
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.warning("Failed to record LLM span", exc_info=True)


async def delete_run_spans(run_id: str) -> None:
    """删除属于某个 run 的所有 span。"""
    try:
        factory = get_session_factory()
        async with factory() as session:
            await session.execute(delete(LLMSpanDB).where(LLMSpanDB.run_id == run_id))
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.warning("Failed to delete spans for run %s", run_id, exc_info=True)


__all__ = [
    "summarize_body",
    "open_node_span",
    "close_node_span",
    "record_llm_span",
    "delete_run_spans",
    "_truncate",
]
