# 03 Agent 执行引擎

## 业务闭环

```
接收需求 → 加载 Agent 配置 → 构建 System Prompt → 注入历史 Memory + RAG 上下文 → LangGraph 状态机执行 → 各角色轮转发言 → 收敛检测 → 保存结果 → 提取 Memory
```

## 子模块

| 子模块 | 说明 |
|---|---|
| [orchestration](orchestration/) | LangGraph 多 Agent 编排（PM→程序员→测试员 状态机） |
| [streaming](streaming/) | WebSocket 流式输出 + Redis pub/sub |

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `MessagesPanel` (流式消息展示) · `TeamMessage` (团队消息) |
| **后端核心** | `team_graph.py` (TeamGraph 状态机) · `agent_graph.py` (单 Agent ReAct) |
| **后端任务** | `tasks.py` (_run_agent_pipeline) |
| **提示词** | `prompts.py` (get_system_prompt, build_*_task) |
| **提取器** | `extractors.py` (PM 文档/代码/审查意见提取) |
| **数据库表** | `project_runs` (pm_document, code, review, approved) |

## 数据流

```
需求输入
    │
    ▼
加载 Agent 配置 (agent_configs 表)
    │
    ▼
构建 System Prompt (prompts.py)
    │
    ├── 注入历史 Memory (_build_session_context)
    ├── 注入 RAG 上下文 (_get_rag_context)
    │
    ▼
LangGraph 状态机 (team_graph.py)
    │
    ├── PM 节点 ──▶ 输出 PRD (pm_document)
    │                  │
    │                  ▼ [直接回复?]
    │                  ├── 是 ──▶ END
    │                  └── 否 ──▶ 继续
    │
    ├── 前端工程师节点 ──▶ 输出前端代码
    │
    ├── 后端工程师节点 ──▶ 输出后端代码
    │
    ├── 测试员节点 ──▶ 输出审查意见
    │                  │
    │                  ▼ [批准?]
    │                  ├── 是 ──▶ END
    │                  └── 否 ──▶ 循环回前端工程师 (最多 MAX_ROUNDS 轮)
    │
    ▼
保存结果 (project_runs 表)
    │
    ▼
提取 Memory (extractors.py)
    ├── PM 文档 → memory_entries (content_type: pm_document)
    ├── 代码 → memory_entries (content_type: code)
    └── 审查意见 → memory_entries (content_type: review)
```

## 核心文件

| 文件 | 职责 |
|---|---|
| `team_graph.py` | LangGraph 状态机编排，定义 PM→前端→后端→测试员 的轮转流程 |
| `agent_graph.py` | 单 Agent ReAct 引擎，处理单个角色的推理和行动 |
| `tasks.py` | Celery 异步任务，串联 Prompt 构建 → Agent 执行 → 结果保存 |
| `prompts.py` | System Prompt 模板，定义每个角色的行为约束 |
| `extractors.py` | 正则提取器，从 Agent 输出中提取 PM 文档/代码/审查意见 |
| `streaming.py` | StreamEmitter，通过 Redis pub/sub 推送流式消息 |
| `checkpoint.py` | 会话检查点，支持对话中断后恢复 |
