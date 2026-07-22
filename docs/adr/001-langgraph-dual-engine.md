# ADR 001: LangGraph as the Dual Agent Engine

**Status**: Accepted

## Context

AgentStudio needs two distinct agent orchestration patterns: (1) single-agent ReAct loops for individual tool-using agents, and (2) multi-agent DAG workflows where a team of agents collaborates with fan-out/fan-in topology. We evaluated CrewAI (role-based multi-agent) and AutoGen (conversation-driven multi-agent) alongside LangGraph.

## Decision

We chose **LangGraph** for both engines. Single-agent runs use `SingleAgentGraph` (`backend/agent_graph.py`) — a standard ReAct loop with tool-calling, where MCP tools get an `mcp_` prefix and skill tools get a `skill_` prefix. Multi-agent runs use `DynamicTeamGraph` (`backend/workflow/dynamic_team_graph.py`) — roles and edges are read from the database's `WorkflowConfig`, allowing configurable DAG topologies with parallel fan-out nodes and fan-in aggregation.

LangGraph was chosen because:
- **Unified runtime**: Both patterns share the same `StateGraph`, checkpointer, and streaming infrastructure (Redis pub/sub via `StreamEmitter`), reducing code duplication.
- **Explicit state management**: Unlike CrewAI's implicit shared memory or AutoGen's unstructured conversation bus, LangGraph's typed state channels make multi-agent data flow predictable and debuggable.
- **Flexible topology**: Dynamic team DAGs can be reconfigured at runtime via database rows rather than code changes, meeting our product requirement for user-defined workflows.
- **Checkpointing**: LangGraph's built-in `CheckpointDB` (memory/SQLite/PostgreSQL) supports interruption and resumption, which aligns with our continuation flow (`/api/runs/complete`).

CrewAI and AutoGen were rejected because they lack first-class graph primitives (edges, conditional routing, state reducers) needed for DAG orchestration, and adopting them would require maintaining two separate agent runtimes.

## Consequences

- Single code path for state management, tool binding, and streaming regardless of agent count.
- Heavier learning curve for contributors unfamiliar with graph-based agent design.
- Tight coupling to LangGraph's API surface — migration to alternatives would require rewriting both `agent_graph.py` and `dynamic_team_graph.py`.
