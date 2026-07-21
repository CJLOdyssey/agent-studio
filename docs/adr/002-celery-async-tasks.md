# ADR 002: Celery for Background Agent Execution

**Status**: Accepted

## Context

Agent runs are long-lived tasks — a single ReAct loop can span dozens of tool calls over minutes. We needed a background execution mechanism that isolates these workloads from the FastAPI request-response cycle, survives process restarts, and scales horizontally. We evaluated in-process `asyncio.create_task`, RQ, and Celery with Redis as the broker.

## Decision

We chose **Celery** with Redis as both broker and result backend. Agent runs are dispatched from `backend/tasks.py`, which parses JSON config, looks up tools and agents from the database, constructs `ToolConfig` objects, binds them to a LangGraph graph, and executes via `asyncio.run()` (wrapped in `_run_async`). Results are streamed through Redis pub/sub via `StreamEmitter` rather than returned synchronously.

Key reasons:
- **Process isolation**: A runaway agent (infinite loop, OOM) cannot crash the API server. Celery workers run in separate OS processes.
- **Horizontal scaling**: Workers can be scaled independently from the API tier. Heavy agent workloads don't compete with HTTP request handling for CPU.
- **Mature ecosystem**: Built-in retries, rate limiting, task routing, and monitoring (Flower) without custom infrastructure.

In-process `asyncio.create_task` was rejected because it couples agent execution to the uvicorn event loop — an agent crash takes down the server. RQ was rejected because it lacks native retry policies and scheduled task support.

**Notable exception**: The continuation flow (`POST /api/runs/complete`) runs directly in the uvicorn process via `asyncio.create_task` to avoid Celery worker Docker image rebuilds during development. This is acceptable because continuation runs are shorter (prefix completion) and the trade-off favors iteration speed.

## Consequences

- Additional operational overhead: Celery workers must be provisioned and monitored alongside the API server.
- Two execution paths (Celery for main runs, in-process for continuation) add minor code path divergence.
- Redis dependency is mandatory — no fallback broker for lightweight deployments.
