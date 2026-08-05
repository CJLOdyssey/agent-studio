# Backend Complex Module Verification & Completion Plan

> Date: 2026-07-27
> Scope: Non-CRUD backend modules that power the AgentStudio frontend
> API Layer Status: ⚠️ **22 CRUD modules × full stack verified — gaps found**
> UI Holes: **3 UI modules have unimplemented features (stub/empty handlers)**

---

## Table of Contents

0. [Full CRUD Inventory by Domain](#0-full-crud-inventory-by-domain)
1. [Agent Execution Engine](#1-agent-execution-engine)
2. [Prompt Generation & Validation Engine](#2-prompt-generation--validation-engine)
3. [Tool Execution & MCP Calling](#3-tool-execution--mcp-calling)
4. [WebSocket Streaming](#4-websocket-streaming)
5. [Interruption & Recovery (Continue Generation)](#5-interruption--recovery-continue-generation)
6. [RAG Engine](#6-rag-engine)
7. [Implementation Priority & Effort](#7-implementation-priority--effort)

---

## 0. Full CRUD Inventory by Domain

### Domain: Auth & Users

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 1 | `GET /auth/config` | `auth/profile.py` | inline | — | — | ✅ |
| 2 | `GET /auth/me` | `auth/profile.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 3 | `POST /auth/login` | `auth/login.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 4 | `POST /auth/register` | `auth/register.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 5 | `POST /auth/verify` | `auth/register.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 6 | `POST /auth/refresh` | `auth/login.py` | `repository/auth.py` | `RefreshTokenDB` | `refresh_tokens` | ✅ |
| 7 | `POST /auth/logout` | `auth/login.py` | `repository/auth.py` | `RefreshTokenDB` | `refresh_tokens` | ✅ |
| 8 | `POST /auth/forgot-password` | `auth/password.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 9 | `POST /auth/reset-password` | `auth/password.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 10 | `POST /auth/change-password` | `auth/password.py` | `repository/auth.py` | `UserDB` | `users` | ✅ |
| 11 | `POST /auth/send-register-code` | `auth/register.py` | Redis | — | — | ✅ |
| 12 | `POST /auth/resend-verification` | `auth/register.py` | Redis | — | — | ✅ |
| 13 | `POST /auth/merge` | `auth/profile.py` | `repository/auth.py` | multiple | multiple | ✅ |

### Domain: Agents

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 14 | `GET /agents` | `routers/agents.py` | `repository/agents.py` | `AgentConfigDB` | `agent_configs` | ✅ |
| 15 | `GET /agents/{id}` | `routers/agents.py` | `repository/agents.py` | `AgentConfigDB` | `agent_configs` | ✅ |
| 16 | `POST /agents` | `routers/agents.py` | `repository/agents.py` | `AgentConfigDB` | `agent_configs` | ✅ |
| 17 | `PUT /agents/{id}` | `routers/agents.py` | `repository/agents.py` | `AgentConfigDB` | `agent_configs` | ✅ |
| 18 | `DELETE /agents/{id}` | `routers/agents.py` | `repository/agents.py` | `AgentConfigDB` | `agent_configs` | ✅ |
| 19 | `PUT /agents/{id}/toggle` | `routers/agents.py` | `repository/agents.py` | `AgentConfigDB` | `agent_configs` | ✅ |
| 20 | `POST /agents/{id}/test` | `routers/agents.py` | `services/run_service.py` | — | — | ✅ |

### Domain: Teams

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 21 | `GET /teams` | `routers/teams.py` | `repository/teams.py` | `TeamDB` | `teams` | ✅ |
| 22 | `POST /teams` | `routers/teams.py` | `repository/teams.py` | `TeamDB` | `teams` | ✅ |
| 23 | `PUT /teams/{id}` | `routers/teams.py` | `repository/teams.py` | `TeamDB` | `teams` | ✅ |
| 24 | `DELETE /teams/{id}` | `routers/teams.py` | `repository/teams.py` | `TeamDB` | `teams` | ✅ |
| 25 | `POST /teams/{id}/members` | `routers/teams.py` | `repository/teams.py` | `TeamAgentDB` | `team_agents` | ✅ |
| 26 | `DELETE /teams/{id}/members/{mid}` | `routers/teams.py` | `repository/teams.py` | `TeamAgentDB` | `team_agents` | ✅ |
| 27 | `PUT /teams/{id}/members/reorder` | `routers/teams.py` | `repository/teams.py` | `TeamAgentDB` | `team_agents` | ✅ |
| 28 | `PUT .../members/{mid}/link-agent` | `routers/teams.py` | `repository/teams.py` | `TeamAgentDB` | `team_agents` | ✅ |

### Domain: Sessions & Conversations

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 29 | `GET /sessions` | `routers/sessions.py` | `repository/session_repo.py` | `SessionDB` | `sessions` | ✅ |
| 30 | `POST /sessions` | `routers/sessions.py` | `repository/session_repo.py` | `SessionDB` | `sessions` | ✅ |
| 31 | `GET /sessions/{id}` | `routers/sessions.py` | `repository/session_repo.py` | `SessionDB` | `sessions` | ✅ |
| 32 | `PUT /sessions/{id}` | `routers/sessions.py` | `repository/session_repo.py` | `SessionDB` | `sessions` | ✅ |
| 33 | `DELETE /sessions/{id}` | `routers/sessions.py` | `repository/session_repo.py` | `SessionDB` | `sessions` | ✅ |
| 34 | `GET /sessions/{id}/memories` | `routers/sessions.py` | `repository/memory_repo.py` | `MemoryEntry` | `memory_entries` | ✅ |
| 35 | `DELETE /memories/{id}` | `routers/sessions.py` | `repository/memory_repo.py` | `MemoryEntry` | `memory_entries` | ✅ |
| 36 | `GET .../memories/export` | `routers/sessions.py` | `repository/memory_repo.py` | `MemoryEntry` | `memory_entries` | ✅ |
| 37 | `POST /runs` | `routers/runs.py` | `services/run_service.py` | `ProjectRun` | `project_runs` | ✅ |
| 38 | `GET /runs/{id}` | `routers/runs.py` | `repository/run_repo.py` | `ProjectRun` | `project_runs` | ✅ |
| 39 | `POST /runs/complete` | `routers/run_continue.py` | `services/run_service.py` | `ProjectRun` | `project_runs` | ✅ |

### Domain: Tools & MCP & Skills & Prompts

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 40 | `GET /tools` | `routers/tools.py` | `repository/tools.py` | `RegisteredToolDB` | `registered_tools` | ✅ |
| 41 | `POST /tools` | `routers/tools.py` | `repository/tools.py` | `RegisteredToolDB` | `registered_tools` | ✅ |
| 42 | `PUT /tools/{id}` | `routers/tools.py` | `repository/tools.py` | `RegisteredToolDB` | `registered_tools` | ✅ |
| 43 | `DELETE /tools/{id}` | `routers/tools.py` | `repository/tools.py` | `RegisteredToolDB` | `registered_tools` | ✅ |
| 44 | `POST /tools/validate` | `routers/tools.py` | `services/tool_config.py` | — | — | ✅ |
| 45 | `POST /tools/execute` | `routers/tools.py` | `services/tool_handlers.py` | — | — | ✅ |
| 46 | `POST /tools/{id}/test` | `routers/tools.py` | `services/tool_config.py` | — | — | ✅ |
| 47 | `GET /mcps` | `routers/mcps.py` | `repository/mcps.py` | `MCPServerDB` | `mcp_servers` | ✅ |
| 48 | `POST /mcps` | `routers/mcps.py` | `repository/mcps.py` | `MCPServerDB` | `mcp_servers` | ✅ |
| 49 | `PUT /mcps/{id}` | `routers/mcps.py` | `repository/mcps.py` | `MCPServerDB` | `mcp_servers` | ✅ |
| 50 | `DELETE /mcps/{id}` | `routers/mcps.py` | `repository/mcps.py` | `MCPServerDB` | `mcp_servers` | ✅ |
| 51 | `POST /mcps/{id}/test` | `routers/mcps.py` | `services/tool_handlers.py` | — | — | ✅ |
| 52 | `GET /skills` | `routers/skills.py` | `repository/skills.py` | `RegisteredSkillDB` | `registered_skills` | ✅ |
| 53 | `POST /skills` | `routers/skills.py` | `repository/skills.py` | `RegisteredSkillDB` | `registered_skills` | ✅ |
| 54 | `PUT /skills/{id}` | `routers/skills.py` | `repository/skills.py` | `RegisteredSkillDB` | `registered_skills` | ✅ |
| 55 | `DELETE /skills/{id}` | `routers/skills.py` | `repository/skills.py` | `RegisteredSkillDB` | `registered_skills` | ✅ |
| 56 | `GET /prompts` | `routers/prompts.py` | `repository/prompts.py` | `PromptDB` | `prompts` | ✅ |
| 57 | `POST /prompts` | `routers/prompts.py` | `repository/prompts.py` | `PromptDB` | `prompts` | ✅ |
| 58 | `PUT /prompts/{id}` | `routers/prompts.py` | `repository/prompts.py` | `PromptDB` | `prompts` | ✅ |
| 59 | `DELETE /prompts/{id}` | `routers/prompts.py` | `repository/prompts.py` | `PromptDB` | `prompts` | ✅ |
| 60 | **`POST /prompts/generate`** | **❌ MISSING** | — | — | — | **❌** |
| 61 | **`POST /prompts/validate`** | **❌ MISSING** | — | — | — | **❌** |

### Domain: Workflow

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 62 | `GET /workflows` | `routers/workflows.py` | `repository/workflows.py` | `WorkflowConfigDB` | `workflow_configs` | ✅ |
| 63 | `POST /workflows` | `routers/workflows.py` | `repository/workflows.py` | `WorkflowConfigDB` | `workflow_configs` | ✅ |
| 64 | `GET /workflows/teams/{id}` | `routers/workflows.py` | `repository/workflows.py` | `WorkflowConfigDB` | `workflow_configs` | ✅ |
| 65 | `DELETE /workflows/{id}` | `routers/workflows.py` | `repository/workflows.py` | `WorkflowConfigDB` | `workflow_configs` | ✅ |

### Domain: API Keys & Models

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 66 | `GET /keys` | `routers/keys.py` | `repository/keys_crud.py` | `UserApiKey` | `user_api_keys` | ✅ |
| 67 | `POST /keys` | `routers/keys.py` | `repository/keys_crud.py` | `UserApiKey` | `user_api_keys` | ✅ |
| 68 | `PUT /keys/{id}` | `routers/keys.py` | `repository/keys_crud.py` | `UserApiKey` | `user_api_keys` | ✅ |
| 69 | `DELETE /keys/{id}` | `routers/keys.py` | `repository/keys_crud.py` | `UserApiKey` | `user_api_keys` | ✅ |
| 70 | `POST /keys/{id}/test` | `routers/keys.py` | `repository/keys_connectivity.py` | — | — | ✅ |
| 71 | `GET /keys/usage` | `routers/keys.py` | `repository/keys_crud.py` | `KeyUsageLog` | `key_usage_logs` | ✅ |
| 72 | `POST /keys/fetch-models` | `routers/keys.py` | `repository/keys_crud.py` | — | — | ✅ |
| 73 | `GET /models` | `routers/models.py` | `repository/keys_crud.py` | `UserApiKey` | `user_api_keys` | ✅ |

### Domain: Admin & Observability

| # | Frontend API | Backend Router | Repository | ORM Model | DB Table | Status |
|---|-------------|---------------|------------|-----------|----------|--------|
| 74 | `GET /admin/stats` | `routers/admin.py` | `repository/admin_stats.py` | multiple | multiple | ✅ |
| 75 | `GET /admin/logs` | `routers/admin.py` | `repository/admin_stats.py` | `CommandLogDB` | `command_logs` | ✅ |
| 76 | `GET /admin/activity` | `routers/admin.py` | `repository/admin_stats.py` | `AuditLogDB` | `audit_logs` | ✅ |
| 77 | `GET /health` | `core/app.py` | `repository/health.py` | — | — | ✅ |

### Summary

| Metric | Count |
|--------|-------|
| Total CRUD modules (entities) | 22 |
| Total API endpoints | 77 |
| ✅ Verified full stack (FE→BE→Repo→ORM→DB) | 75 |
| ❌ Missing backend endpoints | **2** |
| ⚠️ Needs complex logic verification | 6 modules |

---

## 1. Agent Execution Engine

### Class Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        RunService                                │
├──────────────────────────────────────────────────────────────────┤
│ + start(requirement, session_id, key_id, model) → RunResponse    │
│ + complete(content, session_id, thinking) → RunResponse          │
│ + cancel(run_id) → bool                                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌─────────────────────────┐  ┌─────────────────────────────┐
│    SingleAgentGraph     │  │     DynamicTeamGraph         │
├─────────────────────────┤  ├─────────────────────────────┤
│ - model: str            │  │ - nodes: list[Node]          │
│ - api_key: str          │  │ - edges: list[Edge]          │
│ - base_url: str         │  │ - router: Router             │
│ - temperature: float    │  │ - node_factory: NodeFactory  │
│ - checkpointer          │  ├─────────────────────────────┤
├─────────────────────────┤  │ + run(requirement)           │
│ + run(requirement)      │  │   → AsyncIterator[Event]     │
│   → AsyncIterator[Event]│  └──────────────┬──────────────┘
└──────────┬──────────────┘                 │
           │                                │
           └────────────────┬───────────────┘
                            │
                            ▼
               ┌────────────────────────┐
               │     StreamEmitter      │
               ├────────────────────────┤
               │ + emit(type, data)     │
               │ + flush()              │
               │                        │
               │  ── Redis Pub/Sub ──►  │
               │  ── WebSocket ──► 前端 │
               └────────────────────────┘
                            │
                            ▼
               ┌────────────────────────┐
               │     Checkpointer       │
               ├────────────────────────┤
               │ + save(thread_id,      │
               │     state)             │
               │ + load(thread_id)      │
               │   → State | None       │
               │                        │
               │  ── PostgreSQL ────────│
               │  ── Memory (test) ─────│
               └────────────────────────┘
```

### Sequence Diagram: SingleAgent Conversation

```
Frontend             POST /api/runs      RunService      SingleAgent     StreamEmitter     WS
   │                      │                  │               │               │            │
   │── submitRequirement─►│                  │               │               │            │
   │                      │── start() ──────►│               │               │            │
   │                      │                  │── run() ─────►│               │            │
   │                      │                  │               │── emit() ────►│            │
   │                      │                  │               │ (thinking)    │───────────►│
   │◄─ stream(thinking)──────────────────────────────────────│               │            │
   │                      │                  │               │── emit() ────►│            │
   │                      │                  │               │ (content)     │───────────►│
   │◄─ stream(content)───────────────────────────────────────│               │            │
   │                      │                  │               │── emit() ────►│            │
   │                      │                  │               │ (result)      │───────────►│
   │◄─ result ───────────────────────────────────────────────────────────────│            │
   │                      │                  │◄── done ─────│               │            │
   │                      │◄── start() ──────│               │               │            │
   │◄── 200 {run_id} ─────│                  │               │               │            │
```

### Sequence Diagram: Multi-Agent Workflow

```
Frontend     POST /api/runs    RunService     DynamicTeam      Agent A     Agent B     Router
   │              │                │               │              │          │          │
   │──submit─────►│                │               │              │          │          │
   │              │── start() ────►│               │              │          │          │
   │              │                │── run() ─────►│              │          │          │
   │              │                │               │── route()───►│          │          │
   │              │                │               │              ├── run() ─┤          │
   │              │                │               │◄── result ──┤          │          │
   │              │                │               │── route()───►│          │          │
   │              │                │               │              │          ├── run() ─┤
   │              │                │               │◄── result ──┤          │          │
   │              │                │               │── fan-in ───►│          │          │
   │              │                │               │◄── merged ──┤          │          │
   │              │                │◄── done ──────│              │          │          │
   │◄── result ───│                │               │              │          │          │
```

### Verification Checklist

| # | Item | Expected Behavior | Method |
|---|------|-----------------|--------|
| 1.1 | `SingleAgentGraph.run()` LLM call | Model returns streaming output | Send message, check WebSocket receives `stream` events |
| 1.2 | `StreamEmitter` → Redis → WS | Messages flow emitter→Redis→WS→frontend | Check backend logs for Redis pub, frontend WS status |
| 1.3 | Event sequence: thinking→content→result | Events arrive in order | Frontend console logs |
| 1.4 | `DynamicTeamGraph.run()` DAG orchestration | Multiple agents execute per DAG order | Run a team workflow |
| 1.5 | `Checkpointer` state persistence | State saved/loaded for resume | Call `resumeRun()` after interrupt |
| 1.6 | Tool calling (MCP/Skill) | Agent calls tool → result returned | Configure MCP tool, have agent invoke it |
| 1.7 | Multi-turn conversation | Context preserved across turns | Send 3+ messages consecutively |

---

## 2. Prompt Generation & Validation Engine

### Flow Diagram

```
POST /api/prompts/generate              POST /api/prompts/validate
{ description, category }               { content }
         │                                        │
         ▼                                        ▼
  generate_prompt()                       validate_prompt()
         │                                        │
    ┌────┴────┐                            ┌──────┴──────┐
    ▼         ▼                            ▼             ▼
 LLM Call   Template Fill              Syntax Check   Variable Check
    │         │                        (jinja2/mustache) │
    ▼         ▼                            ▼             ▼
 LLM returns  Template applied        Syntax valid?  Variables valid?
 prompt text  to category              Yes/No        Yes/No
    │         │                            │             │
    └────┬────┘                            └──────┬──────┘
         ▼                                       ▼
 GeneratedPrompt{                         ValidationResult{
   content, variables                      valid: bool,
 }                                         errors: string[]
                                         }
```

### Verification Checklist

| # | Item | Expected | Method |
|---|------|---------|--------|
| 2.1 | `generate_prompt` calls LLM | Returns generated prompt text | `POST /api/prompts/generate` with description |
| 2.2 | Category template applied | Output matches category format | Try different categories |
| 2.3 | `validate_prompt` syntax check | Detects template syntax errors | Send malformed template |
| 2.4 | Variable reference validation | Detects unclosed `{{` or `{%` | Send template with unclosed tags |
| 2.5 | Length limit | Error on exceeding max length | Send oversized content |

---

## 3. Tool Execution & MCP Calling

### Class Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        ToolConfig                           │
├─────────────────────────────────────────────────────────────┤
│ + build_tool_wrapper(tool_row) → _ToolWrapper               │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       _ToolWrapper                           │
├─────────────────────────────────────────────────────────────┤
│ - name: str                                                 │
│ - description: str                                          │
│ - mcp_type: "sse" | "stdio" | None                          │
│ - mcp_endpoint: str | None                                  │
│ - mcp_tool_name: str | None                                 │
│ - instructions: str (for skills)                             │
│ - headers: str (for HTTP tools)                              │
│ - method: str (for HTTP tools)                               │
│ - _run_id: str | None                                       │
│ - _llm: BaseChatModel | None                                │
└─────────────────────────────────────┬───────────────────────┘
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                   ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │  handle_skill   │ │   handle_mcp    │ │ call_http_endpt │
        ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
        │ Return skill    │ │ SSE → httpx     │ │ GET/POST to     │
        │ instructions    │ │ stdio → mcp SDK │ │ configured URL  │
        │ as tool result  │ │ fallback→exec   │ │ with headers    │
        └─────────────────┘ └─────────────────┘ └─────────────────┘
                                      │
                              ┌───────┴───────┐
                              ▼               ▼
                       ┌────────────┐  ┌────────────┐
                       │ execute_mcp │  │call_mcp_sdk│
                       ├────────────┤  ├────────────┤
                       │ SSE via    │  │ stdio via  │
                       │ httpx POST │  │ mcp client │
                       └────────────┘  │ session    │
                                       └────────────┘
```

### Verification Checklist

| # | Item | Expected | Method |
|---|------|---------|--------|
| 3.1 | Tool CRUD | Full CRUD via workstation | Create/edit/delete tool |
| 3.2 | `POST /api/tools/validate` | Syntax validation | Send valid + invalid code |
| 3.3 | `POST /api/tools/execute` | Code execution | Send a simple tool script |
| 3.4 | `POST /api/tools/{id}/test` | Calls tool endpoint | Configure + test |
| 3.5 | MCP SSE connection | Connects to remote MCP server | Configure SSE MCP + test |
| 3.6 | MCP stdio connection | Spawns subprocess communication | Configure stdio MCP + test |
| 3.7 | MCP fallback (`execute_tool`) | Falls back to HTTP POST / local cmd | MCP without SSE/stdio |
| 3.8 | Skill instruction load | Returns skill instruction text | Call `handle_skill` |
| 3.9 | LLM fallback | Uses LLM when no other handler matches | Configure tool without endpoint |
| 3.10 | Error propagation | Timeout/HTTP error returned gracefully | Point tool to invalid URL |

---

## 4. WebSocket Streaming

### Connection Lifecycle

```
Frontend                          Backend
   │                                │
   │──── POST /api/runs ───────────►│
   │                                │── RunService.start()
   │                                │── SingleAgentGraph.run()
   │                                │── StreamEmitter → Redis pub
   │◄── 200 { run_id, session_id } ─│
   │                                │
   │──── WS /ws/runs/{run_id} ─────►│
   │                                │── Redis sub → stream events
   │                                │
   │◄── { type: "thinking_stream" }─────── 0..N
   │◄── { type: "thinking_done" } ──────── 0..1
   │◄── { type: "stream" } ─────────────── 0..N  (content chunks)
   │◄── { type: "message" } ────────────── 0..N  (complete messages)
   │◄── { type: "result" } ─────────────── 0..1  (run complete)
   │                                │── WS close
   │                                │
   │  [WS disconnects before result] │
   │                                │── Reconnect (up to 3 retries)
   │──── WS /ws/runs/{run_id} ─────►│  (exponential backoff)
   │                                │
   │  [Max retries exhausted]       │
   │                                │── apiStatus stuck at "running"
   │                                │
   │  [Workaround: sync on wsStatus]│
   │  When wsStatus→'disconnected'  │
   │  sync messages to conversation │
```

### Frontend Event Handler Dispatch

```
WS onmessage
    │
    ▼
parseEvent(data)
    │
    ├── type = "stream"          → handleStreamEvent()
    ├── type = "thinking_stream" → handleThinkingStreamEvent()
    ├── type = "message"         → handleMessageEvent()
    ├── type = "thinking_done"   → handleThinkingDoneEvent()
    ├── type = "info"            → handleInfoEvent()
    ├── type = "error"           → handleErrorEvent()
    ├── type = "balance_warning" → handleBalanceWarningEvent()
    ├── type = "open_url"        → handleOpenUrlEvent()
    ├── type = "result"          → handleResultEvent()
    │                               └── status: "running" → "idle"
    ├── type = "team_result"     → handleTeamResultEvent()
    │                               └── status: "running" → "idle"
    └── type = "thumbs"          → handleThumbsEvent()
```

### Verification Checklist

| # | Item | Expected | Method |
|---|------|---------|--------|
| 4.1 | WS connection established | `connectRun()` succeeds | Frontend WS status: connecting→connected |
| 4.2 | Event sequence integrity | thinking→content→result in order | Frontend console logs |
| 4.3 | WS disconnect + reconnect | 3 auto-retries with backoff | Kill backend process, observe reconnection |
| 4.4 | `handleResultEvent` | Status transitions running→idle | Check Zustand store after completion |
| 4.5 | `handleErrorEvent` | Error displayed in UI | Cause an LLM error |
| 4.6 | Multi-turn conversation | Context preserved across sends | Send 3+ consecutive messages |
| 4.7 | WS disconnect before result | Messages still synced to conversation | Already fixed via wsStatus dep |
| 4.8 | Concurrent runs | New run replaces old WS connection | Send message while previous is running |

---

## 5. Interruption & Recovery (Continue Generation)

### Sequence Diagram

```
Frontend                          Backend
   │                                │
   │──── submitRequirement ────────►│── RunService.start()
   │                                │── SingleAgentGraph.run()
   │◄── thinking_stream ───────────┤
   │◄── stream ────────────────────┤
   │                                │
   │  [User clicks Stop]            │
   │                                │
   │── cancelRun() ────────────────►│── disconnectRun(run_id)
   │                                │── WS close
   │                                │── Checkpointer.save()
   │                                │── status: running→interrupted
   │                                │
   │  [User clicks "Continue"]      │
   │                                │
   │── POST /runs/complete ────────►│── RunService.complete()
   │   { content, session_id }      │── Checkpointer.load()
   │                                │── New run with context
   │                                │── WS connect
   │◄── thinking_stream ───────────┤
   │◄── stream ────────────────────┤
   │◄── result ────────────────────┤
```

### Version Management

```
中断前的 message.versions = ["原始回复"]
                              │
继续生成后 → versions[1] = "原始回复 + 新内容"
                              │
用户再次继续 → versions[2] = "原始回复 + 新内容 + 更多"
```

### Verification Checklist

| # | Item | Expected | Method |
|---|------|---------|--------|
| 5.1 | `cancelRun()` + checkpoint | State saved on interrupt | Check database after stop |
| 5.2 | `resumeRun()` loads checkpoint | New run starts from interruption point | `POST /runs/complete` |
| 5.3 | Version array populated | Old content in versions[0] | UI version switcher |
| 5.4 | New content appending | Continued content concatenated | Check message text |
| 5.5 | `handleThinkingDone` after continue | Thinking folded, content shown | Continue button click |

---

## 6. RAG Engine

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         RAG Engine                                  │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  File Upload                        User Query                      │
│      │                                  │                           │
│      ▼                                  ▼                           │
│  POST /api/attachments            POST /api/runs                    │
│      │                                  │                           │
│      ▼                                  ▼                           │
│  AttachmentService               SingleAgentGraph                   │
│      │                                  │                           │
│ ┌────┴────┐                            ▼                           │
│ ▼         ▼                      rag_pipeline.py                    │
│ store   chunk                     │                                 │
│ file  rag_chunking.py              ├── query_embedding()            │
│          │                         │      │                        │
│          ▼                         │      ▼                        │
│      chunk[]                       │  text → embedding(vector)      │
│          │                         │      │                        │
│          ▼                         │      ▼                        │
│    rag_embedding.py                 │  rag_store.similarity_search()│
│          │                         │      │                        │
│          ▼                         │      ▼                        │
│    embedding(vector)                │  relevant_chunks[]            │
│          │                         │      │                        │
│          ▼                         │      ▼                        │
│    rag_store.store()                │  LLM generate(prompt + chunks)│
│    (pgvector)                       │      │                        │
│                                     │      ▼                        │
│                                     │  response with citations      │
│                                     └──────────────────────────────│
└────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Uploaded File (.txt, .pdf, .md, .csv)
    │
    ▼
[rag_chunking.py]
    │
    ├── Fixed-size chunk (512 tokens, 128 overlap)
    ├── Markdown section split
    └── Sentence boundary aware
    │
    ▼
[rag_embedding.py]
    │
    ├── Calls embedding API (text-embedding-3-small or similar)
    └── Returns list[float] (1536 dimensions)
    │
    ▼
[rag_store.py]
    │
    ├── PostgreSQL with pgvector extension
    ├── Stores: (chunk_id, embedding, text, metadata, file_id)
    └── Supports: cosine similarity, hybrid search
    │
    ▼
[rag_pipeline.py]  (called during agent execution)
    │
    ├── 1. Embed user query
    ├── 2. similarity_search(query_embedding, top_k=5)
    ├── 3. Format: "根据以下文档片段回答：\n[chunk1]\n[chunk2]..."
    └── 4. Inject into LLM system prompt
```

### Verification Checklist

| # | Item | Expected | Method |
|---|------|---------|--------|
| 6.1 | File upload API | `POST /api/attachments` → 201 | Upload a .txt file |
| 6.2 | Chunking strategy | `rag_chunking.py` splits correctly | Check chunk boundaries |
| 6.3 | Embedding generation | `rag_embedding.py` calls API → vector | Check embedding dimension |
| 6.4 | Vector storage | `rag_store.store()` → pgvector | Direct DB query |
| 6.5 | Similarity search | `rag_store.similarity_search()` → matches | Query with related keywords |
| 6.6 | End-to-end RAG | Agent answers with file content | "根据刚才上传的文件回答..." |
| 6.7 | Multiple file support | Agent retrieves from multiple documents | Upload 2 files, ask cross-file question |
| 6.8 | No-file fallback | Agent responds normally without RAG | Ask without file context |

---

## 7. Implementation Priority & Effort

```
Module               Effort    Current State    Priority    Dependencies
──────               ──────    ─────────────    ────────    ────────────
Agent Engine          Medium   ⚠️ Verify only   P0          LLM API keys configured
WebSocket Streaming    Small   ⚠️ Verify only   P0          Agent Engine
Interrupt & Recovery   Small  ⚠️ Verify only   P0          Agent Engine + Checkpointer
Prompt Gen/Validate   Medium   ⚠️ Verify only   P1          LLM API keys configured
Tool/MCP Execution    Medium   ⚠️ Verify only   P1          Tool CRUD + MCP servers
RAG Engine             Large   ⚠️ Verify only   P2          pgvector + Embedding API
```

### Test Counts by Module

```
Module                  Test Files    Test Count
──────                  ──────────    ──────────
Graph/Workflow (engine)     6          181
Streaming                   5          50+
Services (tool/mcp)         4          111
RAG                         5          30+
Observability               6          60+
Checkpoint                  3          30+
Tasks                       8          60+
E2E                        15          100+
```

Total existing: **2272 tests**. All new work is verification of existing code, not new implementation.

---

## A. Appendix: Frontend UI Holes (UI exists, backend/impl missing)

These are features where the **frontend UI was built** (menu items, buttons, pages) but the **actual implementation** is either a stub/TODO or the backend endpoint is missing.

### A.1 Conversation List — Rename & Pin

| File | Code | Status |
|------|------|--------|
| `ConversationsList.tsx` | Three-dot menu with "重命名", "顶置", "删除" | ⚠️ "删除" works, rename & pin are stubs |
| `AgentStudioSidebar.tsx:154` | `onRename={(id) => {/* TODO */}}` | ❌ Empty handler |
| `AgentStudioSidebar.tsx:155` | `onPin={(id) => {/* TODO */}}` | ❌ Empty handler |

**What exists:**
- i18n translations for `sidebar.rename`, `sidebar.pin`, `sidebar.unpin`, `sidebar.pinned` (both zh-CN and en-US)
- UI currently uses `Conversation` type which has no `isPinned` field
- Backend `SessionDB` ORM model has no pin/rename flag

**TODO:**
- Backend: Add PATCH endpoint to update session title (rename already works via `PUT /api/sessions/{id}`)
- Backend: Add `is_pinned` field to sessions table
- Frontend: Wire `onRename` to call `renameSession()`
- Frontend: Wire `onPin` to toggle pin state and sort pinned conversations to top

### A.2 Hardcoded Category/Type Lists

All in `frontend/src/components/AgentStudio/workstation/_hardcoded-defaults.ts`:

| Module | Hardcoded Values | Backend Endpoint Needed | Status |
|--------|-----------------|------------------------|--------|
| Team categories | dev, ops, test | `GET /api/teams/categories` | ❌ Missing |
| Tool categories | 内置工具, 自定义工具 | `GET /api/tools/categories` | ❌ Missing |
| Skill categories | 前端开发, 后端开发, AI/ML, DevOps, 数据分析 | `GET /api/skills/categories` | ❌ Missing |
| Prompt categories | 系统提示词, 用户提示词, 任务模板, 角色定义 | `GET /api/prompts/categories` | ❌ Missing |
| Output constraint categories | 格式约束, 内容约束, 语言约束, 长度约束 | `GET /api/output-constraints/categories` | ❌ Missing |
| MCP types | stdio, sse | `GET /api/mcps/types` | ❌ Missing |
| Model fallback | GPT-4o, Claude Opus 4, etc. | `GET /api/models` already exists | ✅ |

### A.3 Prompt Generate & Validate

| File | Code | Status |
|------|------|--------|
| `frontend/src/api/client/prompts.ts:48` | `generatePrompt()` → `POST /prompts/generate` | ❌ Backend endpoint missing |
| `frontend/src/api/client/prompts.ts:53` | `validatePrompt()` → `POST /prompts/validate` | ❌ Backend endpoint missing |
| `frontend/src/api/client/__tests__/prompts.test.ts` | Unit tests exist for both | ✅ |
| UI components | Not currently wired to any UI button | N/A |

**Note:** These API functions exist in the client and are tested, but no UI component calls them yet. They were prepared for future use.

### A.4 Summary of UI Holes

| # | Feature | UI | Backend | Priority |
|---|---------|----|---------|----------|
| 1 | Conversation rename | ✅ Menu item exists | ✅ `PUT /api/sessions/{id}` exists, just needs wiring | P0 |
| 2 | Conversation pin | ✅ Menu item exists | ❌ Column + API needed | P1 |
| 3 | Category list endpoints | ✅ Used in forms | ❌ 6 endpoints missing | P1 |
| 4 | Prompt generate | ✅ API client + tests | ❌ No endpoint | P2 |
| 5 | Prompt validate | ✅ API client + tests | ❌ No endpoint | P2 |
