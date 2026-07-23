# ADR 005: DynamicTeamGraph — Configurable Multi-Agent DAG Engine

**Status**: Accepted

## Context

AgentStudio's single-agent engine (`SingleAgentGraph` in `backend/agent_graph.py`) handles ReAct loops well, but many real-world scenarios require multiple agents collaborating in structured workflows — a research agent gathers data, a review agent critiques it, and a report agent synthesizes findings. This multi-agent orchestration must meet three requirements:

1. **Topology flexibility**: Users must define arbitrary DAG topologies (sequential chains, parallel fan-out, conditional branching) without code changes.
2. **DB-backed configuration**: Workflow structure (nodes, edges, strategies) is stored in the database's `WorkflowConfig` / `workflow_nodes` / `workflow_edges` tables, editable via the UI.
3. **Shared infrastructure**: Multi-agent workflows reuse the same streaming pipeline (Redis pub/sub via `StreamEmitter`), checkpointing (`CheckpointDB`), and LLM configuration as the single-agent engine.

We evaluated hardcoding a few fixed workflows (e.g. "research then write") as separate classes, but this would not scale to user-defined workflows. Using a generic DAG engine like Temporal or Prefect was considered but would introduce a second orchestration runtime alongside LangGraph.

## Decision

We built **`DynamicTeamGraph`** (`backend/workflow/dynamic_team_graph.py`) — a LangGraph-based multi-agent DAG engine that reads its topology from the database at runtime.

### Architecture

```
DynamicTeamGraph
  ├── set_workflow(config: WorkflowConfig)  # load DB config
  ├── _build()                              # construct LangGraph StateGraph
  │     ├── NodeFactory.create(node)        # create callable per agent node
  │     └── GraphBuilder.build(config)      # wire nodes + edges into StateGraph
  └── run(requirement, thread_id)           # execute with streaming
```

**Node types** (via `NodeStrategy` enum):
| Strategy | Purpose |
|----------|---------|
| `GENERATOR` | Produce content given a requirement and upstream artifacts |
| `REVIEWER` | Critique and approve/reject the previous node's output |
| `REPORTER` | Synthesize all upstream artifacts into a final report |

**Graph construction** (`GraphBuilder.build`):
- Sorts nodes by `order` field to determine execution sequence.
- Registers each node as a LangGraph node keyed by `role_identifier`.
- For each node, reads its outgoing edges from `WorkflowConfig.edges`:
  - **No outgoing edges** → edge to `END`.
  - **Single unconditional edge** → direct edge to the next node.
  - **Multiple unconditional edges** → fan-out: LangGraph conditional edge that forks to all targets in parallel. The fan-in is handled by LangGraph's state reducer: `WorkflowState.artifacts` uses `_merge_dicts` as a reducer, so each parallel branch merges its artifact into a shared dict.
  - **Conditional edges** → `Router.resolve()` checks the current state against `condition_key` patterns to pick the next node.
- Fan-out with conditional edges enables reviewer-style branching: "approved" → proceed, "rejected" → loop back.

**State management** (`WorkflowState` TypedDict):
```python
class WorkflowState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    requirement: str
    artifacts: Annotated[dict[str, str], _merge_dicts]
    round_number: int
    approved: Annotated[dict[str, bool], _merge_dicts]
```

Each reducer (`add_messages`, `_merge_dicts`) enables LangGraph's parallel branch merging: when fan-out nodes complete, their outputs are reduced into the shared state atomically.

### Why not a separate workflow engine?

- **Same graph primitives**: Both engines use `StateGraph`, checkpointer, and `astream_events` — no new abstractions.
- **Same streaming pipeline**: `StreamEmitter` → Redis pub/sub → WebSocket works identically for both.
- **Same LLM binding**: Both use `ChatOpenAI` with identical config (model, temperature, max_tokens).
- **No operational overhead**: No additional workers, queues, or state stores beyond what the single-agent engine already needs.

### Why not hardcoded workflows?

Hardcoded classes for each workflow topology would not support user-defined workflows stored in the database. Every new workflow shape would require a deployment. The DB-configurable DAG approach allows non-developer users to create workflows through the UI.

## Consequences

- **Positive**: User-defined workflows are stored in DB rows and require zero code changes to add new topologies.
- **Positive**: Shared infrastructure with `SingleAgentGraph` — one code path for streaming, checkpointing, and LLM configuration.
- **Positive**: Fan-out/fan-in parallelism via LangGraph's built-in state reducers, no custom synchronization needed.
- **Negative**: DAG validation happens at runtime (when `set_workflow` is called), not at compile time. Invalid topologies (e.g., cycles, unreachable nodes) surface as runtime errors.
- **Negative**: Debugging distributed DAG executions is harder than linear single-agent traces — the `astream_events` output interleaves multiple agents' events.
- **Negative**: Tight coupling to LangGraph's `StateGraph` API — migrating to a different graph framework would require rewriting both `graph_builder.py` and the node factory.
