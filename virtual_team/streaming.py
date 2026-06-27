"""Streaming emitter — bridges raw httpx streaming events to Redis pub/sub + DB."""

import logging

from virtual_team.broker import publish_run_message
from virtual_team.repository import save_message

logger = logging.getLogger(__name__)


class StreamEmitter:
    def __init__(self, run_id: str):
        self._run_id = run_id
        self._message_index = 0
        self._stream_buffer: list[str] = []
        self._thinking_buffer: list[str] = []
        self._pending_thinking: str | None = None

    async def __call__(self, event: dict):
        kind = event.get("event", "")
        data = event.get("data", {})

        if kind == "on_custom_token":
            content = data.get("content", "")
            if content:
                self._stream_buffer.append(content)
                try:
                    await publish_run_message(self._run_id, {
                        "type": "stream",
                        "agent_name": "Agent",
                        "content": content,
                    })
                except Exception:
                    logger.exception("Stream chunk publish failed for run %s", self._run_id)

        elif kind == "on_custom_thinking":
            rc = data.get("content", "")
            if rc:
                self._thinking_buffer.append(rc)
                try:
                    await publish_run_message(self._run_id, {
                        "type": "thinking_stream",
                        "agent_name": "Agent",
                        "content": rc,
                    })
                except Exception:
                    logger.exception("Thinking stream publish failed for run %s", self._run_id)

        elif kind == "on_node_end":
            await self._flush_buffers()

        elif kind == "on_chat_model_stream":
            chunk = data.get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                self._stream_buffer.append(chunk.content)
                try:
                    await publish_run_message(self._run_id, {
                        "type": "stream",
                        "agent_name": "Agent",
                        "content": chunk.content,
                    })
                except Exception:
                    logger.exception("Stream chunk publish failed for run %s", self._run_id)

        elif kind == "on_chat_model_end":
            await self._flush_buffers()

        elif kind == "on_chain_end":
            name = event.get("name", "")
            if name == "LangGraph":
                await self._flush_buffers()

        elif kind == "on_tool_start":
            tool_name = event.get("name", "tool")
            tool_input = data.get("input", "")
            await self._emit("Agent", f"\U0001f527 \u8c03\u7528\u5de5\u5177: {tool_name}({str(tool_input)[:200]})")

        elif kind == "on_tool_end":
            tool_name = event.get("name", "tool")
            output = str(data.get("output", ""))[:500]
            await self._emit("Agent", f"\U0001f441 {tool_name} \u8fd4\u56de: {output}")

    async def _flush_buffers(self):
        thinking_text = ""
        if self._thinking_buffer:
            thinking_text = "".join(self._thinking_buffer).strip()
            self._thinking_buffer.clear()

        if self._stream_buffer:
            self._stream_buffer.clear()

        if thinking_text:
            try:
                await publish_run_message(self._run_id, {
                    "type": "thinking_done",
                    "agent_name": "Agent",
                    "thinking": thinking_text,
                })
            except Exception:
                logger.exception("Thinking publish failed for run %s", self._run_id)

    async def _emit(self, agent_name: str, content: str, msg_type: str = "message", thinking: str | None = None):
        self._message_index += 1
        payload = {
            "type": msg_type, "role": agent_name, "agent_name": agent_name,
            "content": content, "round_number": self._message_index,
        }
        if not thinking and self._pending_thinking:
            thinking = self._pending_thinking
            self._pending_thinking = None
        if thinking:
            payload["thinking"] = thinking
        try:
            await publish_run_message(self._run_id, payload)
            if msg_type == "message":
                await save_message(
                    run_id=self._run_id, role=agent_name, agent_name=agent_name,
                    content=content, round_number=self._message_index,
                )
        except Exception:
            logger.exception("Stream emit failed for run %s", self._run_id)
