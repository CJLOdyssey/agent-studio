"""Dynamic team graph — LangGraph-based multi-agent workflow execution."""

import asyncio
from collections.abc import Callable
from typing import Any

from context.compressor import ContextCompressor
from context.cost_optimizer import CostOptimizer
from context.smart_cache import get_response_cache
from context.token_budget import TokenBudgetManager
from langchain_openai import ChatOpenAI

from core.infra.logging_config import get_logger
from repository import get_agent_configs
from services.tool_config import ToolConfig
from tasks.tool_bindings import build_agent_tool_configs

from .circuit_breaker import CircuitBreakerRegistry
from .graceful_degradation import (
    DegradationLevel,
    GracefulDegradationManager,
    WorkflowTimeoutController,
)
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
        attachment_context: str = "",
        workflow_timeout: float | None = None,
        node_timeout: float | None = None,
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
        self.attachment_context = attachment_context
        self._config: WorkflowConfig | None = None
        self._graph: Any = None
        self._agent_prompts: dict[str, str] = {}
        self._node_tools: dict[str, list[ToolConfig]] = {}

        # Reliability features
        self.workflow_timeout = workflow_timeout
        self.node_timeout = node_timeout
        self.circuit_breaker_registry = CircuitBreakerRegistry()
        self.timeout_controller = WorkflowTimeoutController(
            total_timeout=workflow_timeout,
            node_timeout=node_timeout,
        )
        self.degradation_manager = GracefulDegradationManager(
            timeout_controller=self.timeout_controller,
            enable_fallback=True,
        )

        # Context management and cost optimization
        self.context_compressor = ContextCompressor(
            max_tokens=max_tokens // 2,
            enable_deduplication=True,
            enable_summarization=True,
        )
        self.token_budget_manager = TokenBudgetManager(
            total_budget=max_tokens * 10,  # Budget for entire workflow
            safety_margin=0.1,
        )
        self.cost_optimizer = CostOptimizer(
            max_tokens_per_node=max_tokens,
            min_cache_hit_rate=0.3,
        )
        self.response_cache = get_response_cache()

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
            attachment_context=self.attachment_context,
        )
        router = Router()
        builder = GraphBuilder(
            factory,
            router,
            checkpointer=self.checkpointer,
            llm=self.llm,
            run_id=getattr(self, "_run_id", ""),
        )
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

        # Start timeout tracking
        self.timeout_controller.start()

        # Iteration rounds loop through the entry node, so the recursion budget
        # scales with max_rounds instead of the hardcoded 100.
        recursion_limit = max(self._config.max_rounds * 20, 100) if self._config else 100
        config = {
            "configurable": {"thread_id": thread_id},
            "recursion_limit": recursion_limit,
        }
        initial_state = create_initial_state(requirement)

        async def execute_graph() -> dict[str, Any]:
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

        # Execute with timeout control
        try:
            if self.workflow_timeout:
                result = await asyncio.wait_for(
                    execute_graph(),
                    timeout=self.workflow_timeout
                )
            else:
                result = await execute_graph()

            # Add degradation metadata
            if self.degradation_manager.current_level != DegradationLevel.NORMAL:
                result["degradation"] = {
                    "level": self.degradation_manager.current_level.value,
                    "events": self.degradation_manager.get_degradation_history(),
                }

            return result

        except TimeoutError:
            logger.error(f"Workflow execution timed out after {self.workflow_timeout}s")
            self.degradation_manager.record_degradation(
                DegradationLevel.FAILSAFE,
                f"Workflow timed out after {self.workflow_timeout}s"
            )
            return {
                "error": "Workflow execution timed out",
                "timeout": self.workflow_timeout,
                "degradation": {
                    "level": DegradationLevel.FAILSAFE.value,
                    "events": self.degradation_manager.get_degradation_history(),
                },
            }
        except Exception as e:
            logger.exception("Workflow execution failed")
            self.degradation_manager.record_degradation(
                DegradationLevel.DEGRADED,
                f"Workflow failed: {str(e)}"
            )
            raise
