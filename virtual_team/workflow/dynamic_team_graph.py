from collections.abc import Callable
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

from virtual_team.logging_config import get_logger
from virtual_team.repository import get_agent_configs, get_workflow_config_by_team
from .graph_builder import GraphBuilder
from .models import WorkflowConfig, WorkflowState, create_initial_state
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
        max_tokens: int = 65536,
        checkpointer: Any | None = None,
    ):
        llm_kwargs: dict = {
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

    async def set_workflow(self, config: WorkflowConfig) -> None:
        self._config = config
        self._agent_prompts = {}
        agents = await get_agent_configs()
        for node in config.nodes:
            for agent in agents:
                if agent.id == node.agent_config_id:
                    self._agent_prompts[node.role_identifier] = agent.system_prompt
                    break
        self._build()

    def set_workflow_sync(self, config: WorkflowConfig, agents: list[Any]) -> None:
        self._config = config
        self._agent_prompts = {}
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
        factory = NodeFactory(self.llm, self._agent_prompts, run_id=getattr(self, "_run_id", ""))
        router = Router()
        builder = GraphBuilder(factory, router, checkpointer=self.checkpointer)
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
        stream_callback: Callable | None = None,
        run_id: str = "",
    ) -> dict:
        if run_id:
            self._run_id = run_id
            self._build()
        if self._graph is None:
            raise RuntimeError("Graph not built — call set_workflow() first")
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": 100,
        }
        initial_state = create_initial_state(requirement)
        if stream_callback:
            events = self._graph.astream_events(initial_state, config, version="v2")
            result = None
            async for event in events:
                if event.get("event") == "on_chain_end" and event.get("name") == "LangGraph":
                    result = event.get("data", {}).get("output")
                    if isinstance(result, dict):
                        for k in ["messages", "requirement", "artifacts", "round_number", "approved"]:
                            result.setdefault(k, initial_state.get(k))
                if stream_callback:
                    try:
                        await stream_callback(event)
                    except Exception:
                        logger.exception("stream_callback failed")
            return result if isinstance(result, dict) else {}
        else:
            result = await self._graph.ainvoke(initial_state, config)
            return result if isinstance(result, dict) else {}
