# 设计审查：AgentStudio 功能性与扩展性批判（2026-08-01）

> 审查角色：设计师视角。范围覆盖后端执行链路与前端管理模块，聚焦**功能性**与**扩展性**。
> 结论：**团队/工作流功能处于"半成品接线"状态**——引擎完整但运行入口接错、节点无工具能力、MCP 会话缓存语义分裂。

---

## 审查范围

- 后端：工具分发（`services/tool_config.py` / `services/tool_handlers.py`）、单 Agent 管线（`tasks/agent_pipeline.py`）、团队/工作流（`workflow/dynamic_team_graph.py` / `workflow/graph_builder.py` / `workflow/node_factory.py` / `workflow/router.py` / `workflow/strategies.py`）、运行编排（`services/run_service.py`）。
- 前端：管理模块统一 CRUD（`workstation/shared/useGenericCrud.ts`）、团队数据流（`hooks/useTeamData.ts`）、状态管理（`useWorkstationState.ts`）。

---

## 一、功能性缺陷（Critical）

### F1. 团队对话完全走错了 pipeline —— `_run_team_pipeline` 是死代码

- **位置**：`services/run_service.py:122-139`
- **问题**：当 `team_id` 存在且有 workflow 时，import 并调度的是 `_run_agent_pipeline`，**不是** `_run_team_pipeline`。而 `_run_team_pipeline`（`tasks/team_pipeline.py`）全库搜索**没有任何调用方**。
- **后果**：所谓"团队对话"实际执行的是**单 Agent 管线**——`DynamicTeamGraph`、`GraphBuilder`、`Router`、`NodeStrategy` 这一整层团队工作流引擎**从未被运行过**。前端 `WorkflowEditor` 配出的节点/边/条件路由全部失效。
- **修复指向**：`run_service.py:127` 的 `from tasks import _run_agent_pipeline` 在 team 分支应为 `from tasks.team_pipeline import _run_team_pipeline`，并传 `team_id`（`_run_team_pipeline` 签名已接受 `team_id`，说明作者原本想接，只是没接上）。

### F2. Workflow 节点完全没有工具能力

- **位置**：`workflow/node_factory.py:34-45`（`__init__` 接受 `tools`），`workflow/dynamic_team_graph.py:69`（调用时**从不传 tools**），`workflow/node_factory.py:72-95`（`node_fn` 只做一次纯文本 LLM 流式调用）。
- **问题**：没有 ToolNode、没有 MCP、没有 registry 分发。
- **后果**：工作流里每个 Agent 节点是"盲人"——不能调工具、不能访问 MCP、不能调用技能。对比单 Agent 管线（完整绑定工具），团队节点能力被阉割。作为"多 Agent 协作"产品，这是核心功能缺失。

### F3. `call_mcp_sdk` 的会话缓存语义自相矛盾

- **位置**：`services/tool_handlers.py:24`（`_mcp_sessions` dict 定义 + "per-run_id MCP session cache, avoids creating a new browser per tool call"）、`:219`（`_mcp_sessions.pop(run_key, None)` 手动清掉刚缓存的 key）、`:211-215`（注释自认 "create fresh session per call, deliberately do NOT cache"）。
- **问题**：三处注释+实现互相矛盾：既有缓存的意图，又在每次调用后删除，还注释"故意不缓存"。
- **后果**：要么是死缓存（可删），要么意图分裂——对同一 MCP 会话内多轮工具调用，状态（如浏览器页面）会丢失，与 "browser state persists" 初衷相悖。

---

## 二、扩展性缺陷（Important）

### E1. `sanitize_tool_name` 的哈希名不可逆 —— 无法从工具名反查注册表

- **位置**：`services/tool_config.py:138-141`
- **问题**：非 ASCII 名被折叠成 `tool_<hash>`。但 `_resolve_handler` 和 registry 分发靠 `name` 匹配。一旦工具名被哈希化，**前端展示名、后端 handler 路由、MCP 子工具名三者解耦**，调试和日志无法追踪。中文工具名（前端大量使用中文）会全部落入这个坑。

### E2. 前端 `useGenericCrud` 是好的抽象，但扩展点割裂

- **位置**：`workstation/shared/useGenericCrud.ts`（统一 CRUD/分页/筛选，质量不错）
- **问题**：新增一个资源类型仍需同时改 5 处：types + api + validate + emptyForm + tabConfig。且 `Agent` 绑定资源（`modals/tabs/useConfigItemEdit.ts`）与全局管理模块（`useGenericCrud`）是**两套平行 CRUD**，同一实体（工具/MCP/Skill）有两份 `FormData` 转换逻辑（`itemsToToolFormData` vs `useGenericCrud` 的 `emptyForm`），字段增删要同步维护两处——扩展成本翻倍。

### E3. registry 插件系统只支持"名字前缀路由"，无版本/命名空间

- **位置**：`thinking_tree/registry.py` 用全局 `tool_name → handler` 平铺映射。
- **问题**：两个 MCP 服务器暴露同名子工具（如都有 `read`）时，`mcp_{name}_read` 前缀由 `tasks/agent_pipeline.py:203` 拼接，但**前端工具选择与 registry 之间没有这层命名空间的概念**——扩展多 MCP 时会撞名。

### E4. 团队消息前端链路缺乏显式类型守卫

- **位置**：前端 `stores/chatActions.ts` 同时传 `agent_id`/`team_id`；后端 `services/run_service.py:79` 有一条隐晦分支：续聊时若会话已绑定 agent，会把 `agent_id` 从会话回填。
- **问题**：这与团队会话混合时可能把团队会话错误升级为 agent 会话。职责判断分散在多个 if 里，扩展新的会话种类（如多团队）时会继续叠加特例。

---

## 三、功能性小问题（Minor）

- **M1** `tasks/agent_pipeline.py:322-348` 意图检测用硬编码 `_SITE_MAP` 中文站名映射 + 正则——与"移除硬编码"方向相反，且与已删除的 `open_user_browser` 强绑定（现在发布了 `open_url` 事件但没有任何消费它的工具，浏览器端可能静默失败）。
- **M2** `workflow/dynamic_team_graph.py:104-105` 用 `setdefault` 填充 `messages/requirement/artifacts/round_number/approved`，但 `result` 来自 `on_chain_end` 的 LangGraph 输出，若链中途异常终止，`result` 可能是空 dict，静默返回空结果而非错误。
- **M3** `workflow/graph_builder.py:47-53` 对 `condition_key` 分支的 END 映射里 `lambda s, nid=node.role_identifier: END` —— **lambda 无条件返回 END**，但又在 `end_map` 里放了 `{"*": END}`。这段条件 END 逻辑实际等价于无条件 END，写死分支条件却被忽略，是隐藏的无效代码路径。
- **M4** 团队节点 `stream_llm_response` 的 thinking 流用 `on_custom_thinking` 事件类型，但 `workflow/node_factory.py` 的 `cb` 只发 `thinking_stream`/`stream`——前端 `thinking` UI 依赖后端事件类型，跨 pipeline 的事件契约未统一（单 agent 与 team 用不同事件形状）。

---

## 四、总体评价

**好的方面**：

- `_ToolWrapper` 的字段驱动分发（无硬编码名字匹配）是重构的最大亮点，扩展新工具类型只需新增 `kind`。
- `useGenericCrud` 抽象到位，管理模块代码显著收敛。
- 超时后 `_kill_stuck_child_processes` 的进程回收思路正确，处理了 LangGraph 子进程泄漏这一真实痛点。

**核心问题**：**团队/工作流功能处于"半成品接线"状态**——引擎完整（GraphBuilder/Router/Strategies 设计清晰），但：

1. 运行入口接错了 pipeline（F1），整个引擎从未执行；
2. 节点无工具能力（F2），即使接对了也是纯文本玩具；
3. MCP 会话缓存语义分裂（F3）。

这三个问题叠加，意味着**当前产品里"多 Agent 协作"实际上没有真正工作**。这是必须先修的功能性地基，然后才是扩展性优化。

---

## 修复优先级

| 优先级 | 编号 | 简述 |
|--------|------|------|
| P0 | F1 | run_service 团队分支接入 `_run_team_pipeline` |
| P0 | F2 | workflow 节点绑定工具（registry/MCP/HTTP/Skill） |
| P1 | F3 | 统一 MCP 会话缓存语义（删死缓存或实现真缓存） |
| P2 | E1/E2/E3/E4 | 工具名哈希可逆性、前端 CRUD 双轨、registry 命名空间、会话类型守卫 |
| P3 | M1-M4 | 意图检测重构、团队图空结果处理、条件 END 死逻辑、事件契约统一 |
