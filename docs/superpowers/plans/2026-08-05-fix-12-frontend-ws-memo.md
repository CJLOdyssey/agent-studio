# Fix 12: 前端 P1 修复（WS token + displayMessages memo）Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p12 main -b fix/p12-frontend`）。只修改本文件列出的文件。

**Goal:** 修 WS 认证死代码；恢复 `TeamMessage` memo 有效性，消除无关渲染的全量重渲染。
**Architecture:** `websocket.ts` 移除不存在的 `auth_token` 读取（认证走 httpOnly cookie，/ws/ 为公开前缀）；`displayMessages` 包 `useMemo`；`MessagesPanel` 回调包 `useCallback`。
**Tech Stack:** React 18 / TypeScript 5.6 / Zustand / WebSocket

## 并行协调

- 独占文件：`frontend/src/api/websocket.ts`、`frontend/src/api/__tests__/websocket.test.ts`、`frontend/src/components/AgentStudio/useWorkstationState.ts`、`frontend/src/components/AgentStudio/MessagesPanel.tsx`
- 无共享文件（仅 frontend）

## Global Constraints

- 不修改其它方案的独占文件
- 不改变 WS 对外 API（`connectRun`/`disconnectRun`/`setMaxRetries` 签名不变）
- 保持既有测试通过；必要时更新 websocket 测试
- 提交遵循 .gitmessage 格式

---

## 根因

① `websocket.ts:15` 读 `localStorage.getItem('auth_token')`，但全仓再无代码写入 `auth_token`（真实认证是 httpOnly cookie + `agentstudio_refresh_token`）→ WS URL token 恒空，且后端 `PUBLIC_PREFIXES` 含 `/ws/`，token 参数无意义。② `useWorkstationState.ts:432-446` `displayMessages` 每次渲染 `apiMessages.map(...)` 重建引用 → `MessagesPanel.tsx:90-109` 传给 `memo(TeamMessage)` 的 `msg` 引用每次变化，memo 形同虚设，任何无关 state 变化触发全量重渲染。

## Files

- Modify: `frontend/src/api/websocket.ts`（`buildWsUrl` L14-18）
- Modify: `frontend/src/api/__tests__/websocket.test.ts`
- Modify: `frontend/src/components/AgentStudio/useWorkstationState.ts`（`displayMessages` L432-446）
- Modify: `frontend/src/components/AgentStudio/MessagesPanel.tsx`（回调 L41-68）

---

- [ ] **Step 1: websocket.ts 移除死 token**

```ts
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

/** Build WS URL. Auth is cookie-based (httpOnly) — same-origin handshake carries it. */
function buildWsUrl(runId: string): string {
  return `${WS_BASE}/runs/${runId}`;
}
```

- [ ] **Step 2: 更新 websocket.test.ts**

删除/更新断言 URL 带 `?token=` 的用例，改为断言 `buildWsUrl(runId)` 无 query 且含 `/runs/${runId}`。

- [ ] **Step 3: displayMessages 包 useMemo**

```ts
const displayMessages: Message[] = useMemo(
  () =>
    apiMessages.map((m) => ({
      id: m.id,
      role: m.role === 'user' ? 'user' : 'agent',
      agentId: m.role,
      content: m.content,
      thinking: m.thinking,
      thinkingDone: m.thinkingDone === true,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : 0,
      versions: m.versions,
      currentVersion: m.currentVersion,
      userVersions: m.userVersions,
      currentUserVersion: m.currentUserVersion,
      thumbsFeedback: m.thumbsFeedback,
      interrupted: m.interrupted,
    })),
  [apiMessages],
);
```

- [ ] **Step 4: MessagesPanel 回调包 useCallback**

```tsx
const handleEditMessage = useCallback((msgId: string, newContent: string) => {
  void editAndRegenerate(msgId, newContent);
}, [editAndRegenerate]);

const handleRegenerate = useCallback(
  (msgId: string) => {
    const idx = displayMessages.findIndex((m) => m.id === msgId);
    if (idx >= 0) void regenerateMessage(idx);
  },
  [displayMessages, regenerateMessage],
);

const handleSwitchUserVersion = useCallback(
  (msgId: string, direction: 'prev' | 'next') => {
    switchUserVersion(msgId, direction);
    const idx = displayMessages.findIndex((m) => m.id === msgId);
    if (idx >= 0) {
      const linked = displayMessages.slice(idx + 1).find((m) => m.role === 'agent');
      if (linked && linked.versions && linked.versions.length > 1) {
        switchVersion(linked.id, direction);
      }
    }
  },
  [displayMessages, switchUserVersion, switchVersion],
);

const handleThumbsFeedback = useCallback(
  (msgId: string, value: 'up' | 'down') => setThumbsFeedback(msgId, value),
  [setThumbsFeedback],
);
```

顶部 `import { useCallback } from 'react'`（若未导入）。

- [ ] **Step 5: 验证**

```bash
cd frontend
npx vitest run src/api/__tests__/websocket.test.ts src/components/AgentStudio/__tests__/useWorkstationState.test.ts 2>&1 | tail -10
npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/websocket.ts frontend/src/api/__tests__/websocket.test.ts \
        frontend/src/components/AgentStudio/useWorkstationState.ts \
        frontend/src/components/AgentStudio/MessagesPanel.tsx
git commit -m "perf(frontend): drop dead WS auth_token, memoize displayMessages & panel handlers"
```

## Self-Review

- `handleSwitchUserVersion` 依赖 `displayMessages`，memo 后引用稳定，findIndex 仍正确
- `useMemo`/`useCallback` 的 deps 完整，无 stale closure
- WS 行为不变（同源 cookie 自动携带；/ws/ 公开前缀无需 token）
