"""原始前缀补全流式输出——带思考的 DeepSeek /beta/chat/completions。"""

import json
from typing import Any

import httpx

from broker import publish_run_message
from core.infra.logging_config import get_logger

logger = get_logger(__name__)


async def stream_prefix_completion(
    url: str,
    headers: dict[str, Any],
    body: dict[str, Any],
    run_id: str,
    timeout: float = 300.0,
) -> tuple[str, list[str]]:
    """从 LLM 端点流式输出前缀补全。

    处理 httpx 流式调用、SSE 解析、思考 token（reasoning_content），
    并将流式事件发布到 Redis。

    返回 (full_content, thinking_chunks)。
    HTTP 错误时抛出 httpx.HTTPStatusError；其他异常向上传播。
    """
    full_content = ""
    thinking_chunks: list[str] = []

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=15.0)) as client, \
            client.stream("POST", url, headers=headers, json=body) as resp:
        if resp.status_code != 200:
            body_text = await resp.aread()
            logger.error(
                "[prefix] LLM %s -> %s: %s",
                url,
                resp.status_code,
                body_text.decode(errors="replace")[:300],
            )
        resp.raise_for_status()

        async for line in resp.aiter_lines():
            if not line or not line.startswith("data: "):
                continue
            data_str = line[6:]
            if data_str.strip() == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
            except json.JSONDecodeError:
                continue

            choices = chunk.get("choices", [])
            if not choices:
                continue
            delta = choices[0].get("delta", {})

            reasoning = delta.get("reasoning_content")
            if reasoning:
                thinking_chunks.append(reasoning)
                await publish_run_message(run_id, {
                    "type": "thinking_stream",
                    "agent_name": "Agent",
                    "content": reasoning,
                })

            token = delta.get("content", "")
            if token:
                full_content += token
                await publish_run_message(run_id, {
                    "type": "stream",
                    "agent_name": "Agent",
                    "content": token,
                })

    return full_content, thinking_chunks
