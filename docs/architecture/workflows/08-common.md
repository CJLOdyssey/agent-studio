# 8. 通用基础设施

> 应用壳、通用 UI 组件、工作台共享模块、版本管理、命令面板。

---

## 架构树

```
8. 通用基础设施
├── 8.1 应用壳
│   ├── 功能：路由 / 主题切换 / CSS 变量 / 国际化 / 首页 / 工作台入口 / 弹窗管理
│   └── FE: App.tsx, ThemedApp, AuthGate, HomeScreen, AgentStudioWorkstation
│
├── 8.2 通用组件
│   ├── 功能：Modal（focus trap + ARIA）/ LoadingSkeleton / EmptyState / ErrorState / ToggleSwitch
│   └── FE: shared/Modal, shared/LoadingSkeleton, shared/EmptyState, shared/ErrorState, shared/ToggleSwitch
│
├── 8.3 工作台通用
│   ├── 功能：CRUD 模块基类 / 分页 / 表单组件 / 确认弹窗 / 版本历史弹窗
│   └── FE: workstation/shared/api-base, WstaPagination, FormField, FormSelect, FormTextarea, CreateModal
│
├── 8.4 版本管理
│   ├── 功能：版本快照创建 / 列表 / 详情
│   ├── BE: routers/versions.py → repository/versions.py
│   └── DB: versions
│
└── 8.5 命令面板
    ├── 功能：内置命令 / 执行调度 / 执行日志
    ├── FE: CommandDropdown
    ├── BE: routers/commands.py → repository/command_logs.py
    └── DB: command_logs
```

---

## 8.1 应用壳

| 项目 | 内容 |
|------|------|
| **功能** | 路由（BrowserRouter + Routes） |
| | 主题切换（亮色 / 暗色） |
| | CSS 变量体系（--color-\* / --shadow-\* / --da-\*） |
| | 国际化（zh-CN + en-US） |
| | 首页（欢迎 + 快捷入口） |
| | 工作台入口（10 Tab） |
| | 弹窗管理（登录 / 设置 / 新项目 / API / 确认） |
| **前端** | App.tsx, ThemedApp, AuthGate, Header |
| | HomeScreen, AgentStudioWorkstation, Modals, WorkstationPage |
| **后端** | 无 |
| **状态** | ✅ |

## 8.2 通用组件

| 项目 | 内容 |
|------|------|
| **功能** | Modal（focus trap + Escape + ARIA） |
| | LoadingSkeleton（表格 / 卡片 / 文本） |
| | EmptyState（空状态占位） |
| | ErrorState（错误显示 + 重试按钮） |
| | ToggleSwitch（CSS peer 实现） |
| **前端** | `shared/Modal.tsx`, `shared/LoadingSkeleton.tsx` |
| | `shared/EmptyState.tsx`, `shared/ErrorState.tsx`, `shared/ToggleSwitch.tsx` |
| **状态** | ✅ |

## 8.3 工作台通用

| 项目 | 内容 |
|------|------|
| **功能** | CRUD 模块基类（defineCrudModule 模式） |
| | 分页组件（WstaPagination） |
| | 表单组件（FormField / FormSelect / FormTextarea） |
| | 确认弹窗（BatchDeleteModal / DeleteConfirmModal） |
| | 版本历史弹窗（VersionHistoryModal） |
| | 下拉 Portal（WstaDropdownPortal） |
| **前端** | `workstation/shared/` 目录下所有组件 |
| **状态** | ✅ |

## 8.4 版本管理

| 项目 | 内容 |
|------|------|
| **功能** | 版本快照创建（任意资源类型） |
| | 版本列表查询 |
| | 版本详情 |
| **后端** | `routers/versions.py` → `repository/versions.py` |
| **ORM** | `VersionDB` → `versions` |
| **状态** | ✅ |

## 8.5 命令面板

| 项目 | 内容 |
|------|------|
| **功能** | 内置命令（清空 / 导出 / 重命名 / 切换模型 / 帮助 / 快捷键） |
| | 命令执行调度 |
| | 执行日志记录 |
| **前端** | CommandDropdown |
| **后端** | `routers/commands.py` → `repository/command_logs.py` |
| **ORM** | `CommandLogDB` → `command_logs` |
| **状态** | ✅ |
