# Add 03: 前端团队协作体验优化 Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-n3 main -b feat/n3-team-ux`）。只修改本文件列出的文件。**禁碰 `frontend/src/api/websocket.ts`/`useWorkstationState.ts`/`MessagesPanel.tsx`（P12）。**

**Goal:** 让团队协作在前端「看得见过程、看得见状态、可干预」——策略选择器、审批/轮次状态展示、HITL 审批弹窗。
**Architecture:** 消费 N1 的 `team_result` 扩展契约（`verdicts`/`rounds`）与 `approval_request` 事件；`WorkflowEditor` 加策略/轮次配置，`TeamMessage` 加状态徽章，流式 handler 接新事件。
**Tech Stack:** React 18 / TypeScript 5.6 / Zustand / antd

## 并行协调

- 独占文件：`frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx`、`frontend/src/stores/chatStreaming.ts`、`frontend/src/stores/streamHandler.ts`、`frontend/src/components/AgentStudio/TeamMessage.tsx`、`frontend/src/stores/wsEvents.ts`、对应 `__tests__/`
- **契约-N1**：后端 `team_result` 返回 `{artifacts, display, verdicts:{role:{approved,reason,rounds}}, rounds}`；HITL 事件 `{type:"approval_request", run_id, node}`；审批提交 `POST /api/team-runs/{run_id}/approve`
- 与 P12（websocket/useWorkstationState/MessagesPanel）零重叠
- 建议 **N1 先 merge**（前端按契约开发，不依赖 N1 代码，但集成顺序 N1→N3 更稳）

## Global Constraints

- 不修改其它方案的独占文件
- 保持既有测试通过；新增测试覆盖新状态
- 遵循既有 workstation 模块模式（useXxxManagement + Xxx + XxxFormModal + __tests__）
- 提交遵循 .gitmessage 格式

---

## 根因（2026-08-05 实证 + 对标）

1. `WorkflowEditor.tsx:184` 新节点策略硬编码 `'generator'`，前端无策略选择 UI（对标 CrewAI 声明式角色缺失）
2. `TeamMessage.tsx` 展示每节点产物但无「审批/重试/轮次」状态（N1 将输出 `verdicts`/`rounds`）
3. 后端审批门禁（N1）需要人工可干预入口（HITL），前端缺弹窗

## Files

- Modify: `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx`
- Modify: `frontend/src/components/AgentStudio/TeamMessage.tsx`
- Modify: `frontend/src/stores/wsEvents.ts`
- Modify: `frontend/src/stores/chatStreaming.ts`
- Modify: `frontend/src/stores/streamHandler.ts`
- Create: `frontend/src/components/AgentStudio/workstation/workflow/__tests__/StrategyPicker.test.tsx`、`frontend/src/components/AgentStudio/__tests__/TeamMessage.verdict.test.tsx`

---

- [ ] **Step 1: wsEvents.ts — 新增事件类型**

```ts
export interface TeamVerdict {
  role: string;
  approved: boolean;
  reason?: string;
  rounds: number;
}

export type WsEvent =
  | { type: 'team_result'; status: string; artifacts: Record<string, string>; display: string;
      verdicts?: Record<string, TeamVerdict>; rounds?: number }
  | { type: 'approval_request'; run_id: string; node: string }
  | /* 既有 stream / thinking_stream / result ... */;
```

- [ ] **Step 2: chatStreaming.ts — 分发 verdicts/approval_request**

在 `team_result` 分支（`chatStreaming.ts:61`）解析 `verdicts`/`rounds` 存入 store；新增 `approval_request` 分支触发审批弹窗状态。

- [ ] **Step 3: streamHandler.ts — 团队会话状态字段**

消息对象增加 `verdict?: TeamVerdict`、`round?: number`；`team_result` 到达时将各节点产物与裁决挂到对应 `agent_name` 消息上。

- [ ] **Step 4: WorkflowEditor.tsx — 策略选择器 + 轮次输入**

在节点属性面板加下拉（generator/reviewer/reporter 三选项 + 中文 label），与 `updateNodeStrategy`（`WorkflowEditor.tsx:190`）打通；工作流配置区加 `max_rounds` 数字输入（序列化进 `WorkflowConfig`）。

```tsx
const STRATEGY_OPTIONS = [
  { value: 'generator', label: t('workflow.strategy.generator') },
  { value: 'reviewer', label: t('workflow.strategy.reviewer') },
  { value: 'reporter', label: t('workflow.strategy.reporter') },
];
```

（`i18n` key 加到对应 locale 文件——`locales.ts` 属于本方案独占范围。）

- [ ] **Step 5: TeamMessage.tsx — 状态徽章 + HITL 审批弹窗**

每节点产物卡片显示裁决徽章（approved ✅ / rejected ❌ / pending ⏳）与轮次；`approval_request` 到达时弹出 antd `Modal`（通过/驳回 + 备注），提交 `POST /api/team-runs/{run_id}/approve`。

- [ ] **Step 6: 测试**

`StrategyPicker.test.tsx`：选择 reviewer → `updateNodeStrategy` 调用 + 节点 data.strategy 更新。
`TeamMessage.verdict.test.tsx`：带 `verdict` 的消息渲染对应徽章；`rounds` 展示。

- [ ] **Step 7: 验证**

```bash
cd frontend
npx vitest run src/components/AgentStudio/workstation/workflow/__tests__/StrategyPicker.test.tsx src/components/AgentStudio/__tests__/TeamMessage.verdict.test.tsx 2>&1 | tail -8
npm run typecheck && npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/AgentStudio/workstation/workflow/ frontend/src/components/AgentStudio/TeamMessage.tsx \
        frontend/src/stores/wsEvents.ts frontend/src/stores/chatStreaming.ts frontend/src/stores/streamHandler.ts
git commit -m "feat(frontend): team collaboration UX — strategy picker, verdict badges, HITL approval modal"
```

## Self-Review

- 契约字段（verdicts/rounds/approval_request）与 N1 完全对齐；后端未上线前前端对缺失字段做可选处理（不崩）
- 不与 P12 的重渲染优化冲突（两者文件互斥）
- 新 i18n key 随本方案落 locales，无跨方案冲突
