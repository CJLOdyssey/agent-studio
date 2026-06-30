# 修复日志：regenerate 后切换版本时 original thinking 丢失

> 模板来源：`docs/sdlc/13-quality-assurance.md` — Part C 质量问题跟踪表

## 问题信息

| 字段 | 内容 |
|------|------|
| 问题编号 | BUG-20260630-001 |
| 问题来源 | 开发自测 |
| 所属阶段 | 编码 / 测试 |
| 问题级别 | 严重 |
| 发现日期 | 2026-06-30 |
| 发现人 | Sisyphus |

## 问题描述

用户在对话中点击"重新生成"后，切换到原始版本（v0），AI 的思考过程（thinking）只显示第一个 chunk（如"我们"），而非完整的原始思考内容。

## 影响范围

- 模块：`frontend/src/stores/chatStore.ts`
- 功能：消息版本切换、重新生成、继续生成
- 所有涉及 `thinkingVersions` 数组读取的操作

## 根本原因

### 直接原因

`agentMsg.thinkingVersions` 是一个**空数组 `[]`**（而非 `undefined`）。在 JavaScript 中，空数组是 truthy 值，因此：

```js
// 错误模式：[] 是 truthy，永远不会走到 fallback
agentMsg.thinkingVersions || (agentMsg.thinking ? [agentMsg.thinking] : [])
// → 返回 []，原始 thinking 被丢弃
```

### 数据流溯源

```
首次对话 WS message 事件：
  m.thinkingVersions = undefined (server 未下发)
  newTV = [...(undefined || [])] = []
  currentVersion = undefined → cv = 0
  newTV[0] = undefined → 条件 newTV[cv] !== undefined 不满足
  → m.thinkingVersions 保持 []

点击"重新生成"：
  regenerateMessage 读取 thinkingVersions = []
  [] || fallback = []           ← 原始 thinking 丢失
  pendingThinkingVersions = []   ← 空的

新 thinking_stream 到达：
  thinkingVersions = [...[], chunk] = ["我们"]  ← 只有新 chunk
```

## 修复方案

### 修复 1：regenerateMessage（~line 601）

```diff
- const currentThinkingVersions = agentMsg.thinkingVersions || (agentMsg.thinking ? [agentMsg.thinking] : []);
+ const currentThinkingVersions = agentMsg.thinkingVersions?.length ? agentMsg.thinkingVersions : (agentMsg.thinking ? [agentMsg.thinking] : []);
```

### 修复 2：message handler（~line 791）

```diff
- const tvBase = m.thinkingVersions || (m.thinking ? [m.thinking] : []);
+ const tvBase = m.thinkingVersions?.length ? m.thinkingVersions : (m.thinking ? [m.thinking] : []);
```

### 修复 3：thinking_stream handler（~line 843）

```diff
- const tvBase = m.thinkingVersions || (m.thinking ? [m.thinking] : []);
+ const tvBase = m.thinkingVersions?.length ? m.thinkingVersions : (m.thinking ? [m.thinking] : []);
```

### 修复 4：switchVersion（~line 496）

```diff
- const thinkingVersions = msg.thinkingVersions || (msg.thinking ? [msg.thinking] : []);
+ const thinkingVersions = msg.thinkingVersions?.length ? msg.thinkingVersions : (msg.thinking ? [msg.thinking] : []);
```

### 修复 5：continueGeneration（~line 149，代码一致性）

新增 `pendingThinkingVersions` 设置，保持与 `pendingVersions` 对称：

```diff
  set({
    continuingId: intId,
    skipThinking: false,
    pendingVersions: interruptedMsg.versions || [interruptedMsg.content],
+   pendingThinkingVersions: interruptedMsg.thinkingVersions?.length
+     ? interruptedMsg.thinkingVersions
+     : (interruptedMsg.thinking ? [interruptedMsg.thinking] : null),
  });
```

## 验证方法

1. 发送对话 → 等待 AI 完整回复（含 thinking）
2. 点击"重新生成" → 等待新版本生成完成
3. 点击"Previous version"切换回 v0
4. **预期**：thinking 区域显示完整的原始思考内容
5. **实际**：✅ 验证通过

## 经验教训

- **`[]` 是 truthy**：`xxx || fallback` 模式在 `xxx` 为空数组时不会走到 fallback，需改用 `xxx?.length ? xxx : fallback`
- **思考对称性**：`pendingVersions` 和 `pendingThinkingVersions` 在所有操作（regenerate、continue、stream、message 事件）中应当成对出现
- **Zustand 初始值**：store 中 `pendingThinkingVersions: null`（而非 `[]`），避免空数组 truthiness 问题

## 相关文件

- `frontend/src/stores/chatStore.ts` — 全部 5 处修复
- `docs/sdlc/13-quality-assurance.md` — 问题记录模板来源

## 状态

| 字段 | 内容 |
|------|------|
| 责任人 | Sisyphus |
| 计划完成日期 | 2026-06-30 |
| 实际完成日期 | 2026-06-30 |
| 验证人 | Sisyphus |
| 验证日期 | 2026-06-30 |
| 当前状态 | 已关闭 |
| 关闭日期 | 2026-06-30 |
