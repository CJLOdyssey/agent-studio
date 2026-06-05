"""
LangGraph-based single Agent engine.

Replaces AutoGen with LangGraph for:
  - Native ReAct loop (agent → tools → agent → ...)
  - Built-in checkpointing (SqliteSaver / MemorySaver)
  - Streaming via astream_events
  - Tool calling via LangChain @tool decorators

Architecture:
  START → agent → [has tool_calls?] ──yes──→ tools → agent
                    └── no ──→ END
"""

from collections.abc import Callable
from typing import Annotated, Any, Literal, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)

# ── State ────────────────────────────────────────────────────────────────────


class AgentState(TypedDict):
    """Typed state for the single-agent graph."""
    messages: Annotated[list[BaseMessage], add_messages]
    system_prompt: str
    session_context: str


# ── Graph builder ────────────────────────────────────────────────────────────

class SingleAgentGraph:
    """
    Builds and runs a ReAct agent graph.

    Usage:
        graph = SingleAgentGraph(model="deepseek-chat", api_key="...", base_url="...")
        result = await graph.run(
            system_prompt="你是产品经理...",
            user_input="写一个贪吃蛇游戏",
            session_context="...",
            tools=[...],
            thread_id="session-123",
        )
    """

    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: str = "",
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        checkpointer: Literal["memory", "sqlite"] = "memory",
        db_path: str = "checkpoints.db",
    ):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens

        # Initialize LLM
        llm_kwargs: dict = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if base_url:
            llm_kwargs["base_url"] = base_url
        self.llm = ChatOpenAI(**llm_kwargs)

        # Checkpointer
        if checkpointer == "sqlite":
            try:
                from langgraph.checkpoint.sqlite import SqliteSaver
                self.checkpointer = SqliteSaver.from_conn_string(db_path)
            except ImportError:
                logger.warning("SqliteSaver not available, falling back to MemorySaver")
                self.checkpointer = MemorySaver()
        else:
            self.checkpointer = MemorySaver()

        # Build graph
        self._graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(AgentState)

        def _agent_node(state: AgentState) -> dict:
            """LLM call — decides whether to use tools or respond directly."""
            messages = state.get("messages", [])
            system_prompt = state.get("system_prompt", "")
            session_context = state.get("session_context", "")

            full_messages = []
            if system_prompt:
                full_messages.append(SystemMessage(content=system_prompt))
            if session_context:
                full_messages.append(SystemMessage(content=f"历史上下文：{session_context}"))
            full_messages.extend(messages)

            # Bind tools if available
            llm_with_tools = self.llm
            if self._tools:
                llm_with_tools = self.llm.bind_tools(self._tools)

            response = llm_with_tools.invoke(full_messages)
            return {"messages": [response]}

        def _tools_node(state: AgentState) -> dict:
            """Execute tool calls from the last AI message."""
            messages = state.get("messages", [])
            last_msg = messages[-1] if messages else None

            if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
                return {}

            tool_messages = []
            for tc in last_msg.tool_calls:
                tool_name = tc.get("name", "")
                tool_args = tc.get("args", {})
                tool_id = tc.get("id", "")

                fn = self._tool_map.get(tool_name)
                if fn:
                    try:
                        result = fn.invoke(tool_args)
                        tool_messages.append(ToolMessage(
                            content=str(result),
                            tool_call_id=tool_id,
                            name=tool_name,
                        ))
                    except Exception as e:
                        tool_messages.append(ToolMessage(
                            content=f"Error: {e}",
                            tool_call_id=tool_id,
                            name=tool_name,
                        ))
                else:
                    tool_messages.append(ToolMessage(
                        content=f"Unknown tool: {tool_name}",
                        tool_call_id=tool_id,
                        name=tool_name,
                    ))

            return {"messages": tool_messages}

        def _should_continue(state: AgentState) -> str:
            """Check if the last message has tool calls."""
            messages = state.get("messages", [])
            last_msg = messages[-1] if messages else None
            if isinstance(last_msg, AIMessage) and last_msg.tool_calls:
                return "tools"
            return END

        workflow.add_node("agent", _agent_node)
        workflow.add_node("tools", _tools_node)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", _should_continue, {"tools": "tools", END: END})
        workflow.add_edge("tools", "agent")

        return workflow.compile(checkpointer=self.checkpointer)

    # ── Tools management ──────────────────────────────────────────────────

    _tools: list = []
    _tool_map: dict[str, Any] = {}

    def set_tools(self, tools: list):
        """Bind LangChain tools to the agent."""
        self._tools = tools
        self._tool_map = {t.name: t for t in tools}
        # Rebuild graph with new tools
        self._graph = self._build_graph()

    # ── Streaming run ─────────────────────────────────────────────────────

    async def run(
        self,
        system_prompt: str,
        user_input: str,
        thread_id: str,
        session_context: str = "",
        chat_history: list[BaseMessage] | None = None,
        stream_callback: Callable | None = None,
    ) -> dict:
        """
        Run the agent graph with streaming.

        Args:
            system_prompt: Agent system prompt
            user_input: User message
            thread_id: Unique thread ID (session ID) for checkpointing
            session_context: RAG-retrieved context
            chat_history: Previous conversation messages for short-term memory
            stream_callback: Async callback for each streaming event

        Returns:
            Dict with final AI response and metadata
        """
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": 25,
        }

        messages: list[BaseMessage] = list(chat_history or [])
        messages.append(HumanMessage(content=user_input))
        initial_state: AgentState = {
            "messages": messages,
            "system_prompt": system_prompt,
            "session_context": session_context,
        }

        final_state = None
        async for event in self._graph.astream_events(initial_state, config=config, version="v2"):
            kind = event.get("event", "")

            if stream_callback:
                await stream_callback(event)

            if kind == "on_chain_end" and event.get("name") == "LangGraph":
                output = event.get("data", {}).get("output", {})
                if output:
                    final_state = output

        # Extract final AI response
        if final_state:
            messages = final_state.get("messages", [])
            for msg in reversed(messages):
                if isinstance(msg, AIMessage) and msg.content:
                    return {
                        "response": msg.content,
                        "tool_calls": [
                            {"name": tc.get("name"), "args": tc.get("args")}
                            for tc in (msg.tool_calls or [])
                        ],
                        "message_count": len(messages),
                    }

        return {"response": "", "tool_calls": [], "message_count": 0}

    def invoke_sync(
        self,
        system_prompt: str,
        user_input: str,
        thread_id: str,
        session_context: str = "",
    ) -> dict:
        """Synchronous invoke — for Celery tasks."""
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": 25,
        }
        initial_state: AgentState = {
            "messages": [HumanMessage(content=user_input)],
            "system_prompt": system_prompt,
            "session_context": session_context,
        }
        result = self._graph.invoke(initial_state, config=config)
        messages = result.get("messages", [])
        final_ai = ""
        tool_calls = []
        for msg in reversed(messages):
            if isinstance(msg, AIMessage):
                final_ai = msg.content or ""
                tool_calls = [
                    {"name": tc.get("name", ""), "args": tc.get("args", {})}
                    for tc in (msg.tool_calls or [])
                ]
                break

        return {
            "response": final_ai,
            "tool_calls": tool_calls,
            "message_count": len(messages),
        }


# ── Built-in tools ──────────────────────────────────────────────────────────

@tool
def web_search(query: str) -> str:
    """Search the web for information."""
    return f"搜索结果：'{query[:200]}' (网络搜索功能已注册，等待后端接入搜索引擎)"


@tool
def read_file(path: str) -> str:
    """Read a file from the workspace."""
    return f"读取文件：'{path}' (文件系统功能已注册，等待后端接入)"


@tool
def write_file(args: str) -> str:
    """Write content to a file. Format: 'path:content'"""
    parts = args.split(":", 1)
    path = parts[0].strip() if parts else args
    return f"写入文件：'{path}' (文件系统功能已注册，等待后端接入)"


DEFAULT_TOOLS = [web_search, read_file, write_file]
