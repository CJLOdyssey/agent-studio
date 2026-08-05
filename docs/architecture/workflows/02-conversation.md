# 2. 对话运行

> 用户在此发送消息、查看回复、管理对话列表。这是核心交互区域。

---

## 架构树

```
2. 对话运行
├── 2.1 消息输入与发送
│   ├── 功能：多行输入框 / 模型选择 / 文件附件 / 命令面板 / 停止生成
│   └── FE: InputToolbar, ModelSelector, FileAttach, CommandDropdown
│
├── 2.2 消息展示与交互
│   ├── 功能：消息气泡 / 思考折叠 / 复制编辑重新生成 / 版本切换 / 继续生成 / 代码块
│   └── FE: MessagesPanel, TeamMessage, CodeBlock, CopyBtn
│
├── 2.3 对话列表与导航
│   ├── 功能：按时间分组 / 虚拟滚动 / localStorage / 更多菜单 / 新建对话
│   ├── FE: ConversationsList, AgentStudioSidebar
│   └── BE: GET /api/sessions → repository/session_repo.py → DB: sessions
│
├── 2.4 Agent 执行引擎
│   ├── 功能：SingleAgent ReAct / DynamicTeam DAG / 流式输出 / Tool 调用 / Checkpoint
│   └── BE: graph/graph.py, workflow/, streaming/, checkpoint/
│
└── 2.5 消息状态管理
    └── FE: chatStore, chatActions, chatStreaming, streamHandler, messageHandler, resultHandler
```

---

## 2.1 消息输入与发送

| 项目 | 内容 |
|------|------|
| **功能** | 多行输入框（Enter 发送 / Shift+Enter 换行） |
| | 模型选择（下拉切换 + 配置回退） |
| | 文件附件（拖拽/点击上传） |
| | 命令面板（/ 触发 + 搜索） |
| | 停止生成（中断流式输出） |
| **前端** | InputToolbar, ModelSelector, FileAttach, CommandDropdown |
| **后端** | 无（纯前端交互） |
| **状态** | ✅ |

## 2.2 消息展示与交互

| 项目 | 内容 |
|------|------|
| **功能** | 用户/Agent 消息气泡 |
| | 思考过程折叠/展开（thinking_stream → thinking_done） |
| | 消息操作（复制/编辑/重新生成/有用/没用） |
| | 版本切换（中断恢复多版本） |
| | 继续生成（中断后追加） |
| | 代码块（语法高亮 + 复制） |
| **前端** | MessagesPanel, TeamMessage, CodeBlock, CopyBtn, LazyCodeBlock |
| **后端** | 无（纯前端展示） |
| **状态** | ✅ |

## 2.3 对话列表与导航

| 项目 | 内容 |
|------|------|
| **功能** | 侧边栏对话列表（按时间分组: 今天/昨天/3天/月/更早） |
| | 选中高亮 + 点击切换 |
| | 虚拟滚动（Virtuoso） |
| | 本地持久化 localStorage |
| | 更多菜单（三点按钮）→ ✅删除 ❌重命名 ❌顶置 |
| | 新建对话 |
| **前端** | ConversationsList, AgentStudioSidebar |
| **后端** | `GET /api/sessions` → `repository/session_repo.py` |
| **ORM** | `SessionDB` → `sessions` |
| **状态** | ⚠️ 重命名/顶置待接入 |

## 2.4 Agent 执行引擎

| 项目 | 内容 |
|------|------|
| **功能** | SingleAgent（ReAct + LLM + Tool Calling） |
| | DynamicTeam（DAG 编排 + Router + fan-out/fan-in） |
| | 流式输出（StreamEmitter → Redis → WebSocket） |
| | 运行时 Tool/MCP/Skill 调用 |
| | LLM Fallback（无匹配 handler 时） |
| | Checkpoint 持久化（PostgreSQL/Memory） |
| **后端** | `graph/graph.py`, `workflow/dynamic_team_graph.py` |
| | `services/tool_handlers.py`, `services/tool_config.py` |
| | `streaming/emitter.py`, `streaming/llm_stream.py` |
| | `checkpoint/` |
| **状态** | ⚠️ 需验证端到端 LLM 调用 + WS 流 + Tool 执行 |

## 2.5 消息状态管理

| 项目 | 内容 |
|------|------|
| **功能** | Zustand store（messages/status/wsStatus/streamingId） |
| | 流式事件分发（stream → thinking_stream → message → result） |
| | 错误/余额警告/打开URL事件 |
| | Message ID 生成（uid.ts） |
| **前端** | chatStore, chatActions, chatStreaming, chatTypes |
| | streamHandler, messageHandler, resultHandler, wsEvents |
| **后端** | 无（纯前端状态） |
| **状态** | ✅ |
