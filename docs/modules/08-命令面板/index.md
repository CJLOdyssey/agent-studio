# 08 命令面板

## 业务闭环

```
快捷键触发 → 命令列表过滤 → 选择命令 → 执行动作 → 日志记录 → UI 响应
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `CommandPalette` (命令面板弹窗) |
| **前端 Hook** | `useCommandPalette` (命令注册/触发) |
| **后端路由** | `commands.py` (命令日志) |
| **数据库表** | `command_logs` |

## 数据流

```
用户按 Cmd+K / Ctrl+K
    │
    ▼
CommandPalette 打开
    │
    ├── 加载内置命令
    ├── 加载 MCP 命令 (mcpCommands)
    │
    ▼
用户输入关键词过滤
    │
    ▼
选择命令 → 执行动作
    │
    ├── 前端命令 → 直接执行 (switchTheme, toggleAgent, 等)
    ├── 后端命令 → 调用 API
    │
    ▼
记录到 command_logs 表
```

## 内置命令

| 命令 | 动作 | 说明 |
|---|---|---|
| `switchTheme` | `switchTheme()` | 切换明暗主题 |
| `toggleAgent` | `toggleAgent()` | 切换 Agent 面板 |
| `togglePreview` | `togglePreview()` | 切换预览面板 |
| `toggleHistory` | `toggleHistory()` | 切换历史面板 |
| `toggleLeftPanel` | `toggleLeftPanel()` | 切换左侧栏 |
| `toggleRightPanel` | `toggleRightPanel()` | 切换右侧栏 |
| `newChat` | `navigate('/home')` | 新建对话 |
| `teamManagement` | `navigate('/devagents/team')` | 团队管理 |

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/commands/logs` | 获取命令日志 |
| POST | `/api/commands/logs` | 记录命令执行 |

## 数据库表

```sql
CREATE TABLE command_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    command VARCHAR(128) NOT NULL,
    arguments JSONB,
    created_at TIMESTAMP
);
```
