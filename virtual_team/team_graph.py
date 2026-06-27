"""
TeamGraph — multi-agent collaboration via LangGraph.

Orchestrates the classic PM → Programmers → Tester workflow:
  1. PM analyzes requirements → produces PRD
  2. Frontend + Backend engineers implement based on PRD
  3. Tester reviews code → approves or requests revisions
  4. If not approved, loop back to step 2 (up to max_rounds)

Architecture:
  START → pm → [direct_reply?] ──yes──→ END
              └── no ──→ frontend → backend → tester
                           └── [approved?] ──no──→ frontend (loop)
                                   └── yes ──→ END
"""

from collections.abc import Callable
from typing import Annotated, Any, TypedDict

from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from virtual_team.logging_config import get_logger
from virtual_team.prompts import APPROVAL_KEYWORD, DIRECT_REPLY_KEYWORD

logger = get_logger(__name__)


def _replace_section(existing: str, section_header: str, new_content: str) -> str:
    """Replace a named section in combined code, or append if not found.

    Sections are delimited by Markdown h2 headers like ``## 前端代码``.
    When the section already exists, its content (up to the next h2 or EOF)
    is replaced with *new_content*.  Otherwise the section is appended.
    """
    if not existing:
        return f"{section_header}\n{new_content}"

    # Find the section start
    header_pattern = f"{section_header}\n"
    start = existing.find(header_pattern)
    if start == -1:
        return f"{existing}\n\n{section_header}\n{new_content}"

    # Find the next h2 after this section
    content_start = start + len(header_pattern)
    next_h2 = existing.find("\n## ", content_start)
    if next_h2 == -1:
        # Last section — replace everything after the header
        return existing[:content_start] + new_content
    else:
        return existing[:content_start] + new_content + existing[next_h2:]


class TeamState(TypedDict):
    """State shared across all agents in a team discussion."""
    messages: Annotated[list[BaseMessage], add_messages]
    requirement: str
    pm_document: str
    code: str
    review: str
    approved: bool
    round_number: int


class TeamGraph:
    """
    Multi-agent team discussion graph.

    Usage:
        team = TeamGraph(model="deepseek-chat", api_key="...", base_url="...")
        result = await team.run(
            requirement="写一个贪吃蛇游戏",
            session_context="...",
            thread_id="session-123",
        )
    """

    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: str = "",
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 65536,
        max_rounds: int = 5,
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.max_rounds = max_rounds

        llm_kwargs: dict = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if base_url:
            llm_kwargs["base_url"] = base_url
        self.llm = ChatOpenAI(**llm_kwargs)

        from virtual_team.checkpoint import create_checkpointer
        self.checkpointer = create_checkpointer()
        self._agent_prompts: dict[str, str] = {}
        self._graph = self._build_graph()

    def set_agents(self, agents: list[dict]):
        """Configure team agents from DB configs.

        Each agent dict should have: role_identifier, system_prompt, name.
        """
        for a in agents:
            self._agent_prompts[a["role_identifier"]] = a["system_prompt"]
        self._graph = self._build_graph()

    def _build_graph(self) -> Any:
        workflow = StateGraph(TeamState)

        # ── PM node ──────────────────────────────────────────────────────
        def _pm_node(state: TeamState) -> dict:
            prompt = self._agent_prompts.get("product_manager",
                "你是产品经理。分析用户需求并输出产品需求文档。"
            )
            full = [
                SystemMessage(content=prompt),
                HumanMessage(content=(
                    f"用户需求：{state.get('requirement', '')}\n\n"
                    "请分析需求并输出产品需求文档。如果是简单问候或闲聊，"
                    f"请在回复末尾加上{DIRECT_REPLY_KEYWORD}。"
                )),
            ]
            response = self.llm.invoke(full)
            content = response.content if hasattr(response, 'content') else str(response)
            return {
                "messages": [response],
                "pm_document": content,
            }

        # ── Frontend node ────────────────────────────────────────────────
        def _frontend_node(state: TeamState) -> dict:
            prompt = self._agent_prompts.get("frontend",
                "你是资深前端工程师。根据产品需求文档编写前端代码。"
            )
            pm_doc = state.get("pm_document", "")
            tester_feedback = state.get("review", "")
            feedback_block = ""
            if tester_feedback:
                feedback_block = f"\n\n测试工程师的反馈（请针对性修改）：\n{tester_feedback}"

            full = [
                SystemMessage(content=prompt),
                HumanMessage(content=f"产品需求文档：\n{pm_doc}{feedback_block}\n\n请编写前端代码实现。"),
            ]
            response = self.llm.invoke(full)
            content = str(response.content) if hasattr(response, 'content') else str(response)
            # Replace code for this round — old versions are preserved in message history
            existing_code = state.get("code", "")
            new_code = _replace_section(existing_code, "## 前端代码", content)
            return {
                "messages": [response],
                "code": new_code,
            }

        # ── Backend node ─────────────────────────────────────────────────
        def _backend_node(state: TeamState) -> dict:
            prompt = self._agent_prompts.get("backend",
                "你是资深后端工程师。根据产品需求文档编写后端代码。"
            )
            pm_doc = state.get("pm_document", "")
            tester_feedback = state.get("review", "")
            feedback_block = ""
            if tester_feedback:
                feedback_block = f"\n\n测试工程师的反馈（请针对性修改）：\n{tester_feedback}"

            full = [
                SystemMessage(content=prompt),
                HumanMessage(content=f"产品需求文档：\n{pm_doc}{feedback_block}\n\n请编写后端代码实现。"),
            ]
            response = self.llm.invoke(full)
            content = str(response.content) if hasattr(response, 'content') else str(response)
            # Replace code for this round — old versions are preserved in message history
            existing_code = state.get("code", "")
            new_code = _replace_section(existing_code, "## 后端代码", content)
            return {
                "messages": [response],
                "code": new_code,
            }

        # ── Tester node ──────────────────────────────────────────────────
        def _tester_node(state: TeamState) -> dict:
            prompt = self._agent_prompts.get("tester",
                "你是测试工程师。审查代码质量并在通过时输出【批准】。"
            )
            pm_doc = state.get("pm_document", "")
            code = state.get("code", "")

            full = [
                SystemMessage(content=prompt),
                HumanMessage(content=(
                    f"产品需求文档：\n{pm_doc}\n\n"
                    f"代码实现：\n{code}\n\n"
                    f"请审查代码是否满足需求，检查代码质量和潜在问题。"
                    f"如全部通过，在回复末尾单独一行输出{APPROVAL_KEYWORD}。"
                    f"否则列出具体问题要求修改。"
                )),
            ]
            response = self.llm.invoke(full)
            content = response.content if hasattr(response, 'content') else str(response)
            approved = APPROVAL_KEYWORD in content
            new_round = state.get("round_number", 1)
            return {
                "messages": [response],
                "review": content,
                "approved": approved,
                "round_number": new_round + 1,
            }

        # ── Routing logic ────────────────────────────────────────────────
        def _after_pm(state: TeamState) -> str:
            pm_doc = state.get("pm_document", "")
            if DIRECT_REPLY_KEYWORD in pm_doc:
                return END
            return "frontend"

        def _after_tester(state: TeamState) -> str:
            if state.get("approved", False):
                return END
            if state.get("round_number", 1) >= self.max_rounds:
                logger.info("Max rounds (%d) reached, ending discussion", self.max_rounds)
                return END
            return "frontend"

        # ── Build graph ──────────────────────────────────────────────────
        workflow.add_node("pm", _pm_node)
        workflow.add_node("frontend", _frontend_node)
        workflow.add_node("backend", _backend_node)
        workflow.add_node("tester", _tester_node)

        workflow.set_entry_point("pm")
        workflow.add_conditional_edges("pm", _after_pm, {END: END, "frontend": "frontend"})
        workflow.add_edge("frontend", "backend")
        workflow.add_edge("backend", "tester")
        workflow.add_conditional_edges("tester", _after_tester, {END: END, "frontend": "frontend"})

        return workflow.compile(checkpointer=self.checkpointer)

    async def run(
        self,
        requirement: str,
        thread_id: str,
        session_context: str = "",
        stream_callback: Callable | None = None,
    ) -> dict:
        """Run the team discussion.

        Returns dict with: pm_document, code, review, approved, round_number, messages_count.
        """
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": 50,
        }

        initial_state: TeamState = {
            "messages": [HumanMessage(content=requirement)],
            "requirement": requirement,
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "round_number": 0,
        }

        final_state = None
        async for event in self._graph.astream_events(initial_state, config=config, version="v2"):  # type: ignore[union-attr]
            kind = event.get("event", "")

            if stream_callback:
                await stream_callback(event)

            if kind == "on_chain_end" and event.get("name") == "LangGraph":
                output = event.get("data", {}).get("output", {})
                if output:
                    final_state = output

        if final_state:
            return {
                "pm_document": final_state.get("pm_document", ""),
                "code": final_state.get("code", ""),
                "review": final_state.get("review", ""),
                "approved": final_state.get("approved", False),
                "round_number": final_state.get("round_number", 0),
                "messages_count": len(final_state.get("messages", [])),
            }

        return {
            "pm_document": "", "code": "", "review": "",
            "approved": False, "round_number": 0, "messages_count": 0,
        }

    def invoke_sync(
        self,
        requirement: str,
        thread_id: str,
        session_context: str = "",
    ) -> dict:
        """Synchronous invoke — for Celery tasks."""
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": 50,
        }
        initial_state: TeamState = {
            "messages": [HumanMessage(content=requirement)],
            "requirement": requirement,
            "pm_document": "",
            "code": "",
            "review": "",
            "approved": False,
            "round_number": 0,
        }
        result = self._graph.invoke(initial_state, config=config)  # type: ignore[union-attr]
        return {
            "pm_document": result.get("pm_document", ""),
            "code": result.get("code", ""),
            "review": result.get("review", ""),
            "approved": result.get("approved", False),
            "round_number": result.get("round_number", 0),
            "messages_count": len(result.get("messages", [])),
        }
