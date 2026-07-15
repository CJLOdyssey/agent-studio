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
        self._pending_thinking_nodes: list[dict] | None = None

    async def __call__(self, event: dict):
        kind = event.get("event", "")
        data = event.get("data", {})

        if kind == "on_custom_token":
            content = data.get("content", "")
            if content:
                self._stream_buffer.append(content)
                try:
                    await publish_run_message(
                        self._run_id,
                        {
                            "type": "stream",
                            "agent_name": "Agent",
                            "content": content,
                        },
                    )
                except Exception:
                    logger.exception("Stream chunk publish failed for run %s", self._run_id)

        elif kind == "on_custom_thinking":
            rc = data.get("content", "")
            if rc:
                self._thinking_buffer.append(rc)
                try:
                    await publish_run_message(
                        self._run_id,
                        {
                            "type": "thinking_stream",
                            "agent_name": "Agent",
                            "content": rc,
                        },
                    )
                except Exception:
                    logger.exception("Thinking stream publish failed for run %s", self._run_id)

        elif kind == "on_node_end":
            await self._flush_buffers()

        elif kind == "on_chat_model_stream":
            chunk = data.get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                self._stream_buffer.append(chunk.content)

        elif kind == "on_chat_model_end":
            await self._flush_buffers()

        elif kind == "on_chain_end":
            name = event.get("name", "")
            if name == "LangGraph":
                await self._flush_buffers()

        elif kind == "on_thinking_nodes":
            nodes = data.get("nodes", [])
            if nodes:
                await self.emit_thinking_nodes(nodes)

        elif kind == "on_tool_complete":
            print(f"\n[DEBUG] streaming: on_tool_complete received tool={data.get('toolName')}")
            await self.emit_tool_complete(data)

        elif kind == "on_client_action":
            action = data.get("action", {})
            print(f"\n[DEBUG] streaming: on_client_action received action={action}")
            await publish_run_message(
                self._run_id,
                {
                    "type": "client_action",
                    "agent_name": "Agent",
                    "action": action,
                },
            )

        elif kind == "on_tool_results":
            tool_name = data.get("tool_name", "")
            tool_call_id = data.get("tool_call_id", "")
            refs = data.get("references", [])
            if tool_name and refs:
                await self.emit_tool_results(tool_name, tool_call_id, refs)

        elif kind == "on_tool_start":
            tool_name = event.get("name", "tool")
            tool_input = data.get("input", "")
            await self._emit(
                "Agent",
                f"\U0001f527 \u8c03\u7528\u5de5\u5177: {tool_name}({str(tool_input)[:200]})",
            )

        elif kind == "on_tool_end":
            tool_name = event.get("name", "tool")
            output = str(data.get("output", ""))[:500]
            await self._emit("Agent", f"\U0001f441 {tool_name} \u8fd4\u56de: {output}")

    async def emit_balance_warning(self, message: str = ""):
        await publish_run_message(
            self._run_id,
            {
                "type": "balance_warning",
                "agent_name": "System",
                "content": message or "模型余额不足，请检查 API Key 配置",
            },
        )

    async def emit_thinking_nodes(self, nodes: list[dict]):
        max_pending = 20
        if self._pending_thinking_nodes:
            self._pending_thinking_nodes.extend(nodes)
            if len(self._pending_thinking_nodes) > max_pending:
                self._pending_thinking_nodes = self._pending_thinking_nodes[-max_pending:]
        else:
            self._pending_thinking_nodes = nodes[:max_pending]

    async def emit_tool_results(self, tool_name: str, tool_call_id: str, references: list[dict]):
        await publish_run_message(
            self._run_id,
            {
                "type": "tool_results",
                "agent_name": "Agent",
                "toolName": tool_name,
                "tool_call_id": tool_call_id,
                "references": references,
            },
        )

    async def emit_tool_complete(self, data: dict):
        try:
            node = {
                "type": "tool_result",
                "content": f"{data.get('toolName', '')} {'✅ 成功' if data.get('status') == 'success' else '❌ 失败'}",
                "toolName": data.get("toolName", ""),
                "status": data.get("status", "success"),
            }
            print(f"\n[DEBUG] emit_tool_complete: publishing node type={node['type']} tool={node['toolName']}")
            await publish_run_message(
                self._run_id,
                {
                    "type": "tool_complete",
                    "agent_name": "Agent",
                    "node": node,
                },
            )
            print("\n[DEBUG] emit_tool_complete: published successfully")
        except Exception as e:
            print(f"\n[DEBUG] emit_tool_complete ERROR: {e}")
            import traceback
            traceback.print_exc()

    async def _flush_buffers(self):
        thinking_text = ""
        if self._thinking_buffer:
            thinking_text = "".join(self._thinking_buffer).strip()
            self._thinking_buffer.clear()

        if self._stream_buffer:
            full_content = "".join(self._stream_buffer)
            self._stream_buffer.clear()
            self._message_index += 1
            try:
                await publish_run_message(
                    self._run_id,
                    {
                        "type": "message",
                        "role": "Agent",
                        "agent_name": "Agent",
                        "content": full_content,
                        "round_number": self._message_index,
                    },
                )
                await save_message(
                    run_id=self._run_id,
                    role="Agent",
                    agent_name="Agent",
                    content=full_content,
                    thinking=thinking_text,
                    round_number=self._message_index,
                )
            except Exception:
                logger.exception("Stream publish failed for run %s", self._run_id)

        if thinking_text:
            try:
                payload: dict = {
                    "type": "thinking_done",
                    "agent_name": "Agent",
                    "thinking": thinking_text,
                }
                if self._pending_thinking_nodes:
                    payload["nodes"] = self._pending_thinking_nodes
                    self._pending_thinking_nodes = None
                await publish_run_message(self._run_id, payload)
            except Exception:
                logger.exception("Thinking publish failed for run %s", self._run_id)

    async def _emit(
        self, agent_name: str, content: str, msg_type: str = "message", thinking: str | None = None
    ):
        self._message_index += 1
        payload = {
            "type": msg_type,
            "role": agent_name,
            "agent_name": agent_name,
            "content": content,
            "round_number": self._message_index,
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
                    run_id=self._run_id,
                    role=agent_name,
                    agent_name=agent_name,
                    content=content,
                    thinking=thinking,
                    round_number=self._message_index,
                )
        except Exception:
            logger.exception("Stream emit failed for run %s", self._run_id)
