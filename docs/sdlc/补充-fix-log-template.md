# 补充模板：修复日志 / RCA 文档模板

> **补充说明**：本模板填补 SDLC 文档体系中技术修复日志（Root Cause Analysis）模板的空白。与 `13-quality-assurance.md` Part C（QA 过程问题跟踪）的区别在于：QA 跟踪表用于**流程管理**（谁、什么状态、什么时候关闭），本模板用于**技术复盘**（为什么会出问题、怎么修的、学到了什么）。
>
> 适用场景：线上事故复盘、疑难 Bug 技术回溯、架构决策复盘。

---

## 1. 模板说明

修复日志应在缺陷修复完成后编写，包含以下四个部分：

| Part | 内容 | 目的 |
|------|------|------|
| A | 基本信息 | 快速定位：时间、模块、影响 |
| B | 根因分析 | 追溯：为什么发生 |
| C | 修复方案 | 记录：做了什么改动 |
| D | 复盘总结 | 沉淀：如何避免再犯 |

---

## Part A — 基本信息

| 字段 | 说明 | 填写示例 |
|------|------|---------|
| 标题 | 简短描述问题 | regenerate 后切换版本时 original thinking 丢失 |
| 修复编号 | 唯一标识，格式：FIX-YYYYMMDD-XXX | FIX-20260630-001 |
| 关联缺陷 | 对应的 Bug 编号（如有） | BUG-20260630-001 |
| 日期 | 修复完成日期 | 2026-06-30 |
| 作者 | 修复人员 | Sisyphus |
| 涉及模块 | 涉及的模块、服务、文件 | `frontend/src/stores/chatStore.ts` |
| 影响范围 | 影响的用户/功能范围 | 所有使用版本切换和重新生成功能的用户 |
| 触发条件 | 什么场景下会触发 | 点击"重新生成"后切换到原始版本 |
| 评审人 | 代码审查人员（可选） | — |

---

## Part B — 根因分析

### 2.1 问题现象

**用户/测试看到的表现**：

> 示例：切换到 v0 后，thinking 区域只显示"我们"两个字，而非完整的思考内容。

### 2.2 根本原因

**一句话概括**：

> 示例：`agentMsg.thinkingVersions` 是空数组 `[]`，JavaScript 中 `[]` 是 truthy，`[] || fallback` 不会走到 fallback。

### 2.3 数据流溯源

**从入口到缺陷点的完整链路**（必要时配调用栈或流程图）：

```
首次对话 WS message 事件：
  m.thinkingVersions = undefined (server 未下发)
  newTV = [...(undefined || [])] = []
  currentVersion = undefined → cv = 0
  newTV[0] = undefined → 条件 newTV[cv] !== undefined 不满足
  → m.thinkingVersions 保持 []

点击"重新生成"：
  regenerateMessage 读取 thinkingVersions = []
  [] || fallback = []              ← 原始 thinking 丢失
  pendingThinkingVersions = []      ← 空的

新 thinking_stream 到达：
  thinkingVersions = [...[], chunk] = ["我们"]  ← 只有新 chunk
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 首次对话无此问题 | 首次生成时 thinkingVersions 从未被初始化，无 `[]` 问题 |
| 仅 regenerate 触发 | 常规发送不涉及版本拷贝，不走 `thinkingVersions` 读取路径 |

---

## Part C — 修复方案

### 3.1 修复策略

**整体思路**：

> 示例：在所有读取 `thinkingVersions` 的地方，将 `xxx || fallback` 替换为 `xxx?.length ? xxx : fallback`，杜绝空数组 truthiness 问题。

### 3.2 修改清单

| # | 文件 | 行号 | 变更说明 |
|---|------|------|---------|
| 1 | `chatStore.ts` | ~496 | switchVersion：`msg.thinkingVersions?.length` 判断 |
| 2 | `chatStore.ts` | ~601 | regenerateMessage：`agentMsg.thinkingVersions?.length` 判断 |
| 3 | `chatStore.ts` | ~791 | message handler：`m.thinkingVersions?.length` 判断 |
| 4 | `chatStore.ts` | ~843 | thinking_stream handler：`m.thinkingVersions?.length` 判断 |
| 5 | `chatStore.ts` | ~149 | continueGeneration：补充缺失的 `pendingThinkingVersions` |

### 3.3 关键代码 diff

```diff
- const currentThinkingVersions = agentMsg.thinkingVersions || (agentMsg.thinking ? [agentMsg.thinking] : []);
+ const currentThinkingVersions = agentMsg.thinkingVersions?.length ? agentMsg.thinkingVersions : (agentMsg.thinking ? [agentMsg.thinking] : []);
```

（其他 3 处同类变更模式相同，略）

### 3.4 验证结果

| 验证项 | 方法 | 结果 |
|--------|------|------|
| 功能验证 | 手动测试：发送 → regenerate → 切换 v0 | ✅ thinking 完整显示 |
| 编译检查 | `npx tsc --noEmit` | ✅ 0 errors |
| LSP 诊断 | `lsp_diagnostics` | ✅ 0 errors |
| 回归 | 常规对话、重新生成、继续生成全流程 | ✅ 正常 |

---

## Part D — 复盘总结

### 4.1 经验教训

| # | 内容 |
|---|------|
| 1 | **`[]` 是 truthy**：`xxx \|\| fallback` 模式在 `xxx` 为空数组时不会走到 fallback，需改用 `xxx?.length ? xxx : fallback` |
| 2 | **对称性原则**：`pendingVersions` 和 `pendingThinkingVersions` 在所有操作中应当成对出现。一方有赋值，另一方也应有 |
| 3 | **Zustand 初始值**：初始状态设为 `null`（而非 `[]`），避免空数组 truthiness 导致隐蔽 bug |

### 4.2 改进建议

| # | 建议 | 优先级 |
|---|------|--------|
| 1 | 在全项目范围内搜索 `xxx \|\| fallback` 模式，排查数组变量（`pendingVersions`、`pendingThinkingVersions`、`versions`、`thinkingVersions`） | P2 |
| 2 | 考虑在 eslint 规则中禁止对数组变量使用 `\|\|` 默认值模式 | P3 |

### 4.3 是否需要更新团队规范

- [ ] 需要更新编码规范
- [ ] 需要更新代码审查检查项
- [x] 不需要，本次属于代码维护经验记录

---

## 2. 文件命名规范

格式：`fix-log-YYYY-MM-DD-简短描述.md`

| 部分 | 规则 | 示例 |
|------|------|------|
| 前缀 | 统一以 `fix-log-` 开头，与普通文档区分 | `fix-log-` |
| 日期 | `YYYY-MM-DD` 格式，按日期排序可自然按时间排列 | `2026-06-30` |
| 描述 | 简短 kebab-case，3-5 个英文单词概括核心问题 | `thinking-versions-empty-array` |
| 后缀 | `.md` | `.md` |

| 示例 | 说明 |
|------|------|
| `fix-log-2026-06-26-thinking-stream.md` | 思考过程流式展示修复 |
| `fix-log-2026-06-30-thinking-versions-empty-array.md` | thinking 空数组导致版本切换丢失 |

---

## 3. 目录结构建议

```
docs/
└── project/
    └── fix-logs/                ← 修复日志存放目录
        ├── fix-log-2026-06-26-thinking-stream.md
        └── fix-log-2026-06-30-thinking-versions-empty-array.md
```
