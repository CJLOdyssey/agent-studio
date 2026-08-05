"""Dynamic team graph — LangGraph-based multi-agent workflow execution."""

from collections.abc import Callable
from typing import Any

from core.infra.logging_config import get_logger
from langchain_openai import ChatOpenAI
from repository import get_agent_configs
from services.tool_config import ToolConfig
from tasks.tool_bindings import build_agent_tool_configs

from .graph_builder import GraphBuilder
from .models import WorkflowConfig, create_initial_state
from .node_factory import NodeFactory
from .router import Router

logger = get_logger(__name__)


class DynamicTeamGraph:
    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: str = "",
        base_url: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 16384,
        checkpointer: Any | None = None,
    ):
        llm_kwargs: dict[str, Any] = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "streaming": True,
        }
        if base_url:
            llm_kwargs["base_url"] = base_url
        self.llm = ChatOpenAI(**llm_kwargs)
        self.checkpointer = checkpointer
        self._config: WorkflowConfig | None = None
        self._graph: Any = None
        self._agent_prompts: dict[str, str] = {}
        self._node_tools: dict[str, list[ToolConfig]] = {}

    async def set_workflow(self, config: WorkflowConfig) -> None:
        self._config = config
        self._agent_prompts = {}
        self._node_tools = {}
        agents = await get_agent_configs()
        agent_tools: dict[str, list[ToolConfig]] = {}
        for node in config.nodes:
            for agent in agents:
                if agent.id == node.agent_config_id:
                    self._agent_prompts[node.role_identifier] = agent.system_prompt
                    if agent.id not in agent_tools:
                        agent_tools[agent.id] = await build_agent_tool_configs(agent)
                    self._node_tools[node.role_identifier] = agent_tools[agent.id]
                    break
        self._build()

    def set_workflow_sync(self, config: WorkflowConfig, agents: list[Any]) -> None:
        self._config = config
        self._agent_prompts = {}
        self._node_tools = {}
        for node in config.nodes:
            for agent in agents:
                if hasattr(agent, "id") and agent.id == node.agent_config_id:
                    prompt = getattr(agent, "system_prompt", "")
                    self._agent_prompts[node.role_identifier] = prompt
                    break
        self._build()

    def _build(self) -> None:
        if not self._config:
            return
        factory = NodeFactory(
            self.llm,
            self._agent_prompts,
            node_tools=self._node_tools,
            run_id=getattr(self, "_run_id", ""),
        )
        router = Router()
        builder = GraphBuilder(factory, router, checkpointer=self.checkpointer, llm=self.llm)
        self._graph = builder.build(self._config)
        logger.info(
            "dynamic_team_graph built: nodes=%d edges=%d max_rounds=%d",
            len(self._config.nodes),
            len(self._config.edges),
            self._config.max_rounds,
        )

    async def run(
        self,
        requirement: str,
        thread_id: str,
        stream_callback: Callable[..., Any] | None = None,
        run_id: str = "",
    ) -> dict[str, Any]:
        if run_id:
            self._run_id = run_id
            self._build()
        if self._graph is None:
            raise RuntimeError("Graph not built — call set_workflow() first")
        # Iteration rounds loop through the entry node, so the recursion budget
        # scales with max_rounds instead of the hardcoded 100.
        recursion_limit = max(self._config.max_rounds * 20, 100) if self._config else 100
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": recursion_limit,
        }
        initial_state = create_initial_state(requirement)
        if stream_callback:
            events = self._graph.astream_events(initial_state, config, version="v2")
            result = None
            async for event in events:
                if event.get("event") == "on_chain_end" and event.get("name") == "LangGraph":
                    result = event.get("data", {}).get("output")
                    if isinstance(result, dict):
                        for k in ["messages", "requirement", "artifacts", "round_number", "approved", "verdicts"]:
                            result.setdefault(k, initial_state.get(k))
                if stream_callback is not None:
                    try:
                        await stream_callback(event)
                    except Exception:
                        logger.exception("stream_callback failed")
            return result if isinstance(result, dict) else {}
        else:
            result = await self._graph.ainvoke(initial_state, config)
            return result if isinstance(result, dict) else {}
