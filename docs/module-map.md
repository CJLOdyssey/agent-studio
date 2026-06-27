# 📊 模块关联图

> **本文件展示各模块间的依赖和关联关系。** 新增模块时必须更新此文件。

---

## 🎯 核心模块关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WorkstationPage.tsx                              │
│                              (工作台入口)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌─────────────────────────┐
│  Agent Management │   │ Prompt Management │   │   Output Management     │
│   (Agent管理)      │   │   (提示词管理)     │   │      (输出约束)          │
│                   │   │                   │   │                         │
│ • AgentManagement │   │ • PromptManagement│   │ • OutputConstraintMgmt  │
│ • AgentFormModal  │   │ • PromptFormModal │   │ • OutputFormModal       │
│ • agent.types     │   │ • types           │   │ • output.types          │
│ • agent.constants │   │ • constants       │   │ • output.constants      │
│ • useAgentManage  │   │ • usePromptData   │   │ • useOutputData         │
│   ment           │   │ • usePromptUI     │   │ • useOutputUI           │
└───────────────────┘   │ • usePromptImport │   │ • api                   │
            │           │   Export          │   │ • locales               │
            │           │ • api             │   │ • mock-data             │
            │           │ • locales         │   │ • __tests__             │
            │           │ • __tests__       │   └─────────────────────────┘
            │                   │                       │
            │                   │                       │
            └───────────────────┼───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AgentConfigModal.tsx                                │
│                            (Agent配置弹窗)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────┬───────────┼───────────┬───────────┐
        │           │           │           │           │
        ▼           ▼           ▼           ▼           ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│SystemPrompt │ │OutputConstr │ │  ToolsTab   │ │   MCPTab    │ │  SkillsTab  │
│    Tab      │ │   aintTab   │ │             │ │             │ │             │
│  (提示词)    │ │   (约束)     │ │   (工具)    │ │   (MCP)     │ │  (Skills)   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
        │               │               │               │               │
        ▼               ▼               ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  Prompt     │ │  Output     │ │    Tool     │ │    MCP      │ │   Skill     │
│ Management  │ │ Management  │ │ Management  │ │ Management  │ │ Management  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

---

## 📋 模块依赖矩阵

| 模块 | 依赖的模块 | 被依赖的模块 |
|------|-----------|-------------|
| Agent Management | Prompt, Output, Tool, MCP (mock-data), Skill | WorkstationPage |
| Prompt Management | — | Agent ConfigModal |
| Output Management | — | Agent ConfigModal |
| Tool Management | — | Agent ConfigModal |
| MCP Management | — | Agent ConfigModal, Agent Management (mock-data) |
| Skill Management | — | Agent ConfigModal |
| Team Management | Agent | WorkstationPage |
| Monitor Center | — | WorkstationPage |
| Log Audit | — | WorkstationPage |
| System Settings | — | WorkstationPage |

---

## 🔗 数据流图

### 1. 工作台入口数据流

```
WorkstationPage
├── activeTab → 切换显示对应 Management 组件
└── 菜单项点击 → setActiveTab('outputs') → 显示 OutputConstraintManagement
```

### 2. Agent 配置数据流

```
AgentManagement
│
├── 点击"配置" → 打开 AgentConfigModal
│   ├── agent 对象传入
│   ├── SystemPromptTab ←→ agent.systemPrompt
│   ├── OutputConstraintTab ←→ agent.outputConstraints
│   ├── ToolsTab ←→ agent.tools
│   ├── MCPTab ←→ agent.mcp
│   └── SkillsTab ←→ agent.skills
│
└── 保存 → onSave(agent) → 更新 AgentManagement 列表
```

### 3. 全局管理数据流

```
OutputConstraintManagement
├── api.ts → OutputAPIService (接口抽象 + DI注入)
│   ├── 开发环境: MOCK_OUTPUTS (本地mock数据)
│   └── 生产环境: 通过 setOutputAPI() 注入真实API
├── useOutputData → 数据层 hook
│   ├── loading/error 状态管理
│   ├── CRUD: addItem / updateItem / removeItem / copyItem
│   ├── retry() 重试机制
│   ├── 搜索/筛选/分页
│   └── 多选/全选
├── useOutputUI → UI 状态 hook
│   ├── 表单: openCreate / openEdit / formData / formErrors
│   ├── 菜单: openMenuId / menuAnchorEl
│   └── 校验: validateForm()
├── OutputConstraintManagement (主页面)
│   ├── ErrorBoundary 包裹 → 渲染崩溃兜底
│   ├── TableSkeleton → 加载态骨架屏
│   ├── useToast → 操作反馈通知
│   └── t('output.xxx') → i18n 国际化
├── OutputFormModal (表单弹窗)
│   ├── React.memo → 性能优化
│   ├── Escape 键关闭
│   └── 表单校验错误提示
└── index.ts → 公共 API 屏障
```

### 4. MCP 全局管理数据流

```
MCPManagement
├── api.ts → MCPAPIService (接口抽象 + DI注入)
│   ├── 开发环境: MOCK_MCPS (mock-data.ts)
│   └── 生产环境: 通过 setMCPAPI() 注入真实API
├── useMCPData → 数据层 hook
│   ├── loading/error 状态管理
│   ├── CRUD: addMCP / removeMCP / copyMCP
│   ├── retry() 重试机制
│   ├── 搜索/筛选/分页
│   └── 多选/全选
├── useMCPUI → UI 状态 hook
│   ├── 表单: openCreate / openEdit / formData / formErrors
│   ├── 菜单: openMenuId / menuAnchorEl (吸入管理)
│   └── 校验: validateForm()
├── MCPManagement (主页面)
│   ├── ErrorBoundary 包裹 → 渲染崩溃兜底
│   ├── TableSkeleton → 加载态骨架屏
│   ├── useToast → 操作反馈通知
│   └── t('mcp.xxx') → i18n 国际化
├── MCPFormModal (表单弹窗)
│   ├── type 切换(stdio ↔ url) 字段联动
│   └── 表单校验错误提示
├── DeleteConfirmModal / BatchDeleteModal / VersionHistoryModal → 共享弹窗
└── index.ts → 公共 API 屏障
```

---

## 📁 文件依赖关系

### 前端模块间导入

```typescript
// WorkstationPage.tsx
import AgentManagement from './workstation/agent/AgentManagement';
import { PromptManagement } from './workstation/prompt';
import OutputConstraintManagement from './workstation/output/OutputConstraintManagement';
// ...

// AgentConfigModal.tsx
import { SystemPromptTab } from './tabs/SystemPromptTab';
import { OutputConstraintTab } from './tabs/OutputConstraintTab';
// ...
```

### 类型共享

```typescript
// agent.types.ts
interface AgentEntry {
  outputConstraints: OutputEntry[];  // 引用 output.types.ts
  prompts: PromptEntry[];            // 引用 prompt/types.ts
  tools: ToolEntry[];                // 引用 tool/tool.types.ts
  mcp: MCPEntry[];                   // 引用 mcp/mcp.types.ts
  skills: SkillEntry[];              // 引用 skill/skill.types.ts
}
```

---

## 🔄 模块更新流程

### 新增模块时

1. **创建模块目录**：`workstation/new-module/`
2. **创建模块文件**：Management, FormModal, types, constants, index.ts
3. **更新 WorkstationPage.tsx**：添加菜单项和组件导入
4. **更新本文件**：添加模块关系说明
5. **更新 CLAUDE.md**：添加模块说明

### 修改模块时

1. **检查依赖**：查看本文件的依赖矩阵
2. **检查关联**：查看数据流图
3. **更新文档**：修改 CLAUDE.md 和本文件

---

## 📊 模块统计

| 类型 | 数量 | 说明 |
|------|------|------|
| 工作台模块 | 10 | agent, prompt, output, tool, mcp, skill, team, monitor, logs, settings |
| 弹窗组件 | 9 | AgentConfigModal, OutputConstraintTab, 等 |
| 共享组件 | 5 | shared/ 目录下的组件 |
| 自定义 Hooks | 12 | useAgentManagement, usePromptData, usePromptUI, usePromptImportExport, useOutputData, useOutputUI, useMCPData, useMCPUI, useToolData, useToolUI, useSkillData, useSkillUI, useTeamData, useTeamUI |
| 类型定义 | 10 | 各模块的 .types.ts 文件 |
| i18n 翻译字典 | 3 | prompt, output, mcp 模块的 locales.ts |
| 测试文件 | 7 | prompt(3) + output(1) + mcp(1) + 集成(2) |

---

## 📝 更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-06-22 | 创建初始模块关联图 |
| 2026-06-22 | 输出约束 + MCP 模块数据流图完善；统计表新增 i18n/测试统计；依赖矩阵更新 |
