"""Streaming emitter — bridges LangGraph events to Redis pub/sub + DB."""

import logging

from virtual_team.broker import publish_run_message
from virtual_team.repository import save_message

logger = logging.getLogger(__name__)


class StreamEmitter:
    def __init__(self, run_id: str):
        self._run_id = run_id
        self._message_index = 0
        self._stream_buffer: list[str] = []

    async def __call__(self, event: dict):
        kind = event.get("event", "")
        data = event.get("data", {})

        if kind == "on_chat_model_stream":
            chunk = data.get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                self._stream_buffer.append(chunk.content)

        elif kind == "on_chat_model_end":
            if self._stream_buffer:
                text = "".join(self._stream_buffer).strip()
                self._stream_buffer.clear()
                if text:
                    await self._emit("Agent", text)

        elif kind == "on_tool_start":
            tool_name = event.get("name", "tool")
            tool_input = data.get("input", "")
            await self._emit("Agent", f"\U0001f527 调用工具: {tool_name}({str(tool_input)[:200]})")

        elif kind == "on_chain_end":
            if event.get("name") == "LangGraph" and self._stream_buffer:
                text = "".join(self._stream_buffer).strip()
                self._stream_buffer.clear()
                if text:
                    await self._emit("Agent", text)

        elif kind == "on_tool_end":
            tool_name = event.get("name", "tool")
            output = str(data.get("output", ""))[:500]
            await self._emit("Agent", f"\U0001f441 {tool_name} 返回: {output}")

    async def _emit(self, agent_name: str, content: str, msg_type: str = "message"):
        self._message_index += 1
        payload = {
            "type": msg_type, "role": agent_name, "agent_name": agent_name,
            "content": content, "round_number": self._message_index,
        }
        try:
            await publish_run_message(self._run_id, payload)
            if msg_type == "message":
                await save_message(
                    run_id=self._run_id, role=agent_name, agent_name=agent_name,
                    content=content, round_number=self._message_index,
                )
        except Exception:
            logger.exception("Stream emit failed for run %s", self._run_id)
