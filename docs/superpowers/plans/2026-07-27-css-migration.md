# CSS 样式迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有 CSS 收归 `frontend/src/styles/` 目录，消除内联样式和 `<style>` 标签，保持视觉效果完全不变。

**Architecture:** 6 个 Phase 按风险从低到高推进。优先用 Tailwind className 替换内联 style，Tailwind 无法处理时退回到 `styles/` 下的 CSS class。Ant Design 组件覆盖保留在 `ant-overrides.css`。

**Tech Stack:** React 18 + Vite 6 + Tailwind v4 + Ant Design v5

---

## 文件改动总览

| 文件 | 操作 | 所在 Phase |
|---|---|---|
| `frontend/src/styles/base/keyframes.css` | 追加 `@keyframes wstaFadeIn/FadeSlideIn` | Phase 1 |
| `frontend/src/styles/workstation/ant-overrides.css` | 追加 `.wsta-root table`、`.api-key-table` 规则 | Phase 1 |
| `frontend/src/styles/workstation/index.css` | 追加 `@import 'reactflow/dist/style.css'` | Phase 1 |
| `frontend/src/styles/base/index.css` | 追加 `.app-loading-screen` | Phase 1 |
| `frontend/src/styles/auth/login.css` | **新建** — LoginModal/ForgotPasswordForm 样式 | Phase 4 |
| `frontend/src/main.tsx` | 追加 `import './styles/auth/login.css'` | Phase 4 |
| `frontend/src/components/AgentStudio/WorkstationPage.tsx` | 删除 2 个 `<style>` 标签 | Phase 1 |
| `frontend/src/components/AgentStudio/modals/ApiProviderTab.tsx` | 删除 `<style>` 标签 | Phase 1 |
| `frontend/src/components/auth/LoginModal.tsx` | 删除 `<style>` 标签 | Phase 1 |
| `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx` | 删除 `import 'reactflow/dist/style.css'` | Phase 1 |
| `frontend/src/App.tsx` | 删除 `loadingScreenStyle` 对象，改 className | Phase 1 |
| 35+ 个组件文件 | `style` → Tailwind `className` | Phase 2 |
| 7 个 Modal 组件文件 | `style={{ maxWidth }}` → `className="max-w-[xxx]"` | Phase 3 |
| `frontend/src/components/auth/LoginModal.tsx` | 内联 style 抽取为 CSS class | Phase 4 |
| `frontend/src/components/auth/ForgotPasswordForm.tsx` | 内联 style 抽取为 CSS class | Phase 4 |
| `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx` | 硬编码色值 → CSS 变量 | Phase 5 |
| 5 个文件 | 加 `// style-skip-migration` 注释 | Phase 6 |

---

### Phase 1: 零风险迁移

#### Task 1.1: 删除 LoginModal.tsx 中重复的 `@keyframes fadeIn`

**Files:**
- Modify: `frontend/src/components/auth/LoginModal.tsx:463-468`

- [ ] **删除重复的 `<style>` 标签**

在 `LoginModal.tsx` 中：

```tsx
// 删除以下内容（第 463-468 行）：
       <style>{`
         @keyframes fadeIn {
           from { opacity: 0; }
           to { opacity: 1; }
         }
       `}</style>
```

理由：`keyframes.css` 第 5-14 行已定义完全相同的 `@keyframes fadeIn`（含 `transform: translateY(8px)`）。

- [ ] **验证**

```bash
npm run build
```
Expected: 无报错。页面 LoginModal 打开时淡入动画效果不变。

- [ ] **提交**

```bash
git add frontend/src/components/auth/LoginModal.tsx
git commit -m "refactor(css): remove duplicate @keyframes fadeIn from LoginModal.tsx"
```

---

#### Task 1.2: 移动 WorkstationPage.tsx 的 `<style>` 规则到 ant-overrides.css

**Files:**
- Modify: `frontend/src/styles/workstation/ant-overrides.css`
- Modify: `frontend/src/components/AgentStudio/WorkstationPage.tsx:37-46`

- [ ] **将 `<style>` 内容追加到 `ant-overrides.css` 末尾**

在 `ant-overrides.css` 末尾追加：

```css
/* ── WorkstationPage table/input overrides (migrated from inline <style>) ── */
.wsta-root table { background: transparent !important; }
.wsta-root table th,
.wsta-root table td { background: transparent !important; }
.wsta-root table thead tr,
.wsta-root table thead th { background: var(--color-surface) !important; }
.wsta-root .wsta-row-selected td { background: transparent !important; }
.wsta-root .ant-input-affix-wrapper { background: var(--color-surface) !important; }
.wsta-root .ant-select-selector { background: var(--color-surface) !important; }
```

- [ ] **从 WorkstationPage.tsx 删除对应的 `<style>` 块**

```tsx
// 删除第 37-46 行：
       <style>{`
         .wsta-root table { background: transparent !important; }
         .wsta-root table th,
         .wsta-root table td { background: transparent !important; }
         .wsta-root table thead tr,
         .wsta-root table thead th { background: var(--color-surface) !important; }
         .wsta-root .wsta-row-selected td { background: transparent !important; }
         .wsta-root .ant-input-affix-wrapper { background: var(--color-surface) !important; }
         .wsta-root .ant-select-selector { background: var(--color-surface) !important; }
       `}</style>
```

- [ ] **验证：LSP diagnostics 无 error，构建通过**

- [ ] **提交**

```bash
git add frontend/src/styles/workstation/ant-overrides.css frontend/src/components/AgentStudio/WorkstationPage.tsx
git commit -m "refactor(css): move WorkstationPage <style> to ant-overrides.css"
```

---

#### Task 1.3: 移动 WorkstationPage.tsx 的 `@keyframes` 到 keyframes.css

**Files:**
- Modify: `frontend/src/styles/base/keyframes.css`
- Modify: `frontend/src/components/AgentStudio/WorkstationPage.tsx:124-133`

- [ ] **将动画追加到 `keyframes.css` 末尾**

```css
/* ── WorkstationPage animations (migrated from inline <style>) ── */
@keyframes wstaFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes wstaFadeSlideIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **从 WorkstationPage.tsx 删除第 124-133 行的 `<style>` 块**

```tsx
// 删除以下内容（第 124-133 行）：
       <style>{`
         @keyframes wstaFadeIn {
           from { opacity: 0; }
           to { opacity: 1; }
         }
         @keyframes wstaFadeSlideIn {
           from { opacity: 0; transform: translateY(4px); }
           to { opacity: 1; transform: translateY(0); }
         }
       `}</style>
```

- [ ] **验证**

```bash
npm run build
```
Expected: 无报错。WorkstationPage 打开和切 Tab 时动画效果不变。

- [ ] **提交**

```bash
git add frontend/src/styles/base/keyframes.css frontend/src/components/AgentStudio/WorkstationPage.tsx
git commit -m "refactor(css): move wstaFadeIn/FadeSlideIn keyframes to keyframes.css"
```

---

#### Task 1.4: 移动 ApiProviderTab.tsx 的 `<style>` 到 ant-overrides.css

**Files:**
- Modify: `frontend/src/styles/workstation/ant-overrides.css`
- Modify: `frontend/src/components/AgentStudio/modals/ApiProviderTab.tsx:203-209`

- [ ] **将 `.api-key-table` 规则追加到 `ant-overrides.css` 末尾**

```css
/* ── ApiProviderTab api-key-table overrides (migrated from inline <style>) ── */
.api-key-table .ant-table-thead > tr > th { border-bottom: none !important; }
.api-key-table .ant-table-tbody > tr > td { border-bottom: none !important; }
.api-key-table .ant-table-tbody > tr.ant-table-row-selected > td { background: transparent !important; }
.api-key-table .ant-table-tbody > tr > td { padding-top: 6px !important; padding-bottom: 6px !important; }
.api-key-table .ant-table-thead > tr > th { padding-top: 6px !important; padding-bottom: 6px !important; }
```

- [ ] **从 ApiProviderTab.tsx 删除第 203-209 行的 `<style>` 块**

```tsx
// 删除以下内容：
       <style>{`
         .api-key-table .ant-table-thead > tr > th { border-bottom: none !important; }
         .api-key-table .ant-table-tbody > tr > td { border-bottom: none !important; }
         .api-key-table .ant-table-tbody > tr.ant-table-row-selected > td { background: transparent !important; }
         .api-key-table .ant-table-tbody > tr > td { padding-top: 6px !important; padding-bottom: 6px !important; }
         .api-key-table .ant-table-thead > tr > th { padding-top: 6px !important; padding-bottom: 6px !important; }
       `}</style>
```

- [ ] **验证**

```bash
npm run build
```
Expected: 无报错。API 管理页面的表格边框/间距不变。

- [ ] **提交**

```bash
git add frontend/src/styles/workstation/ant-overrides.css frontend/src/components/AgentStudio/modals/ApiProviderTab.tsx
git commit -m "refactor(css): move ApiProviderTab <style> to ant-overrides.css"
```

---

#### Task 1.5: 移动 `reactflow/dist/style.css` import 到 workstation/index.css

**Files:**
- Modify: `frontend/src/styles/workstation/index.css`
- Modify: `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx:17`

- [ ] **在 `workstation/index.css` 中追加 `@import`**

```css
@import './ant-overrides.css';
@import 'reactflow/dist/style.css';
```

- [ ] **从 WorkflowEditor.tsx 删除第 17 行的 import**

```tsx
// 删除第 17 行：
import 'reactflow/dist/style.css';
```

- [ ] **验证**

```bash
npm run build
```
Expected: 无报错。WorkflowEditor 页面中 ReactFlow 画布样式不变。

- [ ] **提交**

```bash
git add frontend/src/styles/workstation/index.css frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx
git commit -m "refactor(css): move reactflow style import to workstation/index.css"
```

---

#### Task 1.6: 将 `loadingScreenStyle` 对象迁移到 CSS class

**Files:**
- Modify: `frontend/src/styles/base/index.css`
- Modify: `frontend/src/App.tsx:38-46,61`

- [ ] **在 `base/index.css` 末尾追加 `.app-loading-screen`**

```css
/* ── App loading screen ── */
.app-loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  background: var(--color-surface, #0f1117);
  color: var(--color-text-secondary, #888);
  font-size: 14px;
}
```

- [ ] **在 `App.tsx` 中删除 `loadingScreenStyle` 对象并改 className**

删除第 38-46 行的 `loadingScreenStyle` 对象。

将第 61 行的：
```tsx
return <div style={loadingScreenStyle}>✦ AgentStudio</div>;
```
改为：
```tsx
return <div className="app-loading-screen">✦ AgentStudio</div>;
```

- [ ] **验证**

```bash
npm run build
```
Expected: 无报错。页面首次加载时 loading 屏视觉不变。

- [ ] **提交**

```bash
git add frontend/src/styles/base/index.css frontend/src/App.tsx
git commit -m "refactor(css): migrate loadingScreenStyle to CSS class"
```

---

### Phase 2: 简单 Tailwind 替换

#### Task 2.1-2.35: 批量替换"简单"内联 style

**Files:** 涉及 35 个组件文件，每个文件一个独立子任务。

**通用替换规则**（在每个文件中查找并替换）：

| 匹配模式 | 替换为 |
|---|---|
| `style={{ maxWidth: 320 }}` | `className="max-w-[320px]"` |
| `style={{ width: 120 }}`（Select 上） | `className="w-[120px]"` |
| `style={{ width: 130 }}`（Select 上） | `className="w-[130px]"` |
| `style={{ flex: 1, minWidth: 0 }}` | `className="flex-1 min-w-0"` |
| `style={{ flex: 1 }}` | `className="flex-1"` |
| `style={{ display: 'flex', gap: 6, alignItems: 'center' }}` | `className="flex items-center gap-1.5"` |
| `style={{ display: 'flex', alignItems: 'center', gap: 6 }}` | `className="flex items-center gap-1.5"` |
| `style={{ display: 'flex', alignItems: 'center', gap: 4 }}` | `className="flex items-center gap-1"` |
| `style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}` | `className="flex items-center justify-center"` |
| `style={{ color: 'var(--color-accent)' }}` | `className="text-[var(--color-accent)]"` |
| `style={{ color: 'var(--color-text-muted)' }}` | `className="text-[var(--color-text-muted)]"` |
| `style={{ color: 'var(--color-text-primary)' }}` | `className="text-[var(--color-text-primary)]"` |
| `style={{ color: 'var(--color-text-secondary)' }}` | `className="text-[var(--color-text-secondary)]"` |
| `style={{ color: 'var(--color-danger)' }}` | `className="text-[var(--color-danger)]"` |
| `style={{ fontWeight: 600 }}` | `className="font-semibold"` |
| `style={{ fontWeight: 500 }}` | `className="font-medium"` |
| `style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}` | `className="text-sm text-[var(--color-text-secondary)]"` |
| `style={{ fontSize: 11, color: 'var(--color-text-muted)' }}` | `className="text-xs text-[var(--color-text-muted)]"` |
| `style={{ fontSize: 12, color: 'var(--color-text-muted)' }}` | `className="text-xs text-[var(--color-text-muted)]"` |
| `style={{ fontSize: 13 }}` | `className="text-sm"` |
| `style={{ fontSize: 12 }}` | `className="text-xs"` |
| `style={{ position: 'relative', marginBottom: 14 }}` | `className="relative mb-3.5"` |
| `style={{ position: 'relative', flex: 1 }}` | `className="relative flex-1"` |
| `style={{ position: 'relative' }}` | `className="relative"` |
| `style={{ textAlign: 'center', paddingTop: 28, paddingBottom: 4 }}` | `className="text-center pt-7 pb-1"` |
| `style={{ cursor: 'pointer' }}` | `className="cursor-pointer"` |
| `style={{ whiteSpace: 'nowrap' }}` | `className="whitespace-nowrap"` |
| `style={{ margin: 0 }}` | `className="m-0"` |
| `style={{ marginBottom: 8 }}` | `className="mb-2"` |
| `style={{ marginBottom: 16 }}` | `className="mb-4"` |
| `style={{ marginTop: 4 }}` | `className="mt-1"` |
| `style={{ marginTop: 20 }}` | `className="mt-5"` |
| `style={{ gap: 8 }}` | `className="gap-2"` |
| `style={{ gap: 12 }}` | `className="gap-3"` |
| `style={{ flexShrink: 0 }}` | `className="shrink-0"` |
| `style={{ overflow: 'hidden' }}` | `className="overflow-hidden"` |
| `style={{ minWidth: 0 }}` | `className="min-w-0"` |
| `style={{ lineHeight: 1 }}` | `className="leading-none"` |

**涉及文件列表**（按改写数量排序）：

1. `TeamMessage.tsx` — ~74 处 className（但内联 style 约 6 处需替换）
2. `AgentStudioWorkstation.tsx` — 12 处 `[var(--` + 少量 inline style
3. `TeamTree.tsx` — 16 处 `[var(--`
4. `Workspace.tsx` — 16 处 `[var(--`
5. `CodeBlock.tsx` — 5 处 className + oneDark style（保留）
6. `ResourcePickerSection.tsx` — 9 处内联 style
7. `ResourcePickerModal.tsx` — 多处 `px-6` + 少量内联
8. `LogAudit.tsx` — 6 处内联 + 14 处 className
9. `SettingsModal.tsx` — 14 处内联 style（其中部分复杂，Phase 2 中只替换简单属性）
10. 各 Management 文件（Agent/Tool/Prompt/MCP/Skill/Output/Team）— style 主要在 Select/Input 上

- [ ] **Task 2.1: 替换 `TeamManagement.tsx` 中 Select/Input 的 inline style**

```tsx
// 改前
<Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} />
<Select style={{ width: 120 }} />
<Select style={{ width: 130 }} />
// 改后
<Input prefix={<Search size={14} />} allowClear className="max-w-[320px]" />
<Select className="w-[120px]" />
<Select className="w-[130px]" />
```

验证：`npm run build`

- [ ] **Task 2.2: 替换 `AgentManagement.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.3: 替换 `ToolManagement.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.4: 替换 `PromptManagement.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.5: 替换 `MCPManagement.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.6: 替换 `SkillManagement.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.7: 替换 `OutputConstraintManagement.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.8: 替换 `LogAudit.tsx` 中 Select/Input 的 inline style**

同上。

- [ ] **Task 2.9: 替换 `TeamMemberManager.tsx` 的简单 style**

将以下 style 替换为 Tailwind：
```
style={{ color: 'var(--color-accent)' }} → className="text-[var(--color-accent)]"
style={{ flex: '1 1 0%' }} → className="flex-1"
```
保留 `animationDelay` 的动态计算值（Phase 6 白名单）。

- [ ] **Task 2.10: 替换 `AgentFormModal.tsx` 的简单 style**

```
style={{ marginTop: 14 }} → className="mt-3.5"
style={{ maxWidth: 140 }} → className="max-w-[140px]"
```

- [ ] **Task 2.11: 替换 `TeamFormModal.tsx` 的简单 style**

```
style={{ marginTop: 14 }} → className="mt-3.5"
```

- [ ] **Task 2.12: 替换 `SkillFormModal.tsx` 的简单 style**

```
style={{ display: 'flex', alignItems: 'center', gap: 6 }} → className="flex items-center gap-1.5"
```
保留 `maxWidth`（Phase 3）。

- [ ] **Task 2.13: 替换 `ToolFormModal.tsx` 的简单 style**

```
style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 12px', flexShrink: 0 }}
→ className="whitespace-nowrap inline-flex items-center gap-1 h-9 px-3 shrink-0"
```

- [ ] **Task 2.14: 替换 `TeamTree.tsx` 的简单 style**

```
style={{ paddingLeft: 10, paddingRight: 9 }} → className="px-[10px]"
style={{ padding: '8px 10px', borderRadius: 8 }} → className="p-[8px_10px] rounded-lg"
```

- [ ] **Task 2.15: 替换 `TeamTreeAgentItem.tsx` 的简单 style**

同上。

- [ ] **Task 2.16: 替换 `ConversationsList.tsx` 的简单 style**

```
style={{ color: 'var(--color-accent)' }} → className="text-[var(--color-accent)]"
style={{ height: '100%' }} → className="h-full"
```

- [ ] **Task 2.17: 替换 `DeleteConfirmModal.tsx` 的简单 style**

```
style={{ maxWidth: 420 }} → className="max-w-[420px]"
```

- [ ] **Task 2.18: 替换 `BatchDeleteModal.tsx` 的简单 style**

```
style={{ maxWidth: 420 }} → className="max-w-[420px]"
```

- [ ] **Task 2.19: 替换 `CreateModal.tsx` 的 style**

```tsx
// style 上的 maxWidth 保持不变（动态传入），className 上加 rest
```
保留：`style={{ maxWidth: width }}`（动态 prop）。

- [ ] **Task 2.20: 替换 `ResourcePickerModal.tsx` 的简单 style**

```
style={{ outline: 'none', boxShadow: 'none', WebkitBoxShadow: 'none' }}
→ className="outline-none shadow-none"
style={{ justifyContent: 'space-between' }} → className="justify-between"
```

- [ ] **Task 2.21: 替换 `WstaPagination.tsx` 的简单 style**

```
style={{ paddingBottom: 40 }} → className="pb-10"
```

- [ ] **Task 2.22: 替换 `WstaDropdownPortal.tsx` 的简单 style**

保留：动态 `top`/`left`（Phase 6 白名单）。

- [ ] **Task 2.23: 替换 `ConfirmModal.tsx` 的简单 style**

```
style={{ fontWeight: 600, marginBottom: 4 }} → className="font-semibold mb-1"
```

- [ ] **Task 2.24: 替换 `ConfigItemList.tsx` 的简单 style**

```
style={{ position: 'fixed', top: pos.top, left: pos.left }} → 保留（动态值）
```

- [ ] **Task 2.25: 替换 `MonitorHealth.tsx` 的简单 style**

```
style={{ color: item.status === 'normal' ? '#22c55e' : '#f59e0b' }} → 保留（三元表达式动态值）
style={{ background: item.status === 'normal' ? '#22c55e' : '#f59e0b' }} → 保留
```

- [ ] **Task 2.26: 替换 `MonitorStats.tsx` 的简单 style**

```
style={{ background: 'rgba(99,102,241,0.08)' }} → className="bg-[var(--color-accent)]/10"
```

- [ ] **Task 2.27: 替换 `MonitorActivity.tsx` 的简单 style**

```
style={{ background: act.type === 'success' ? '#22c55e' : act.type === 'warning' ? '#f59e0b' : '#3b82f6' }} → 保留（三元动态）
```

- [ ] **Task 2.28: 替换 `NewProjectModal.tsx` 的简单 style**

```
style={{ color: 'var(--color-text-secondary)', fontSize: '14px', margin: 0 }}
→ className="text-[var(--color-text-secondary)] text-sm m-0"
```

- [ ] **Task 2.29: 替换 `LoadingSkeleton.tsx` 的简单 style**

```
style={{ '--sk-delay': `${r * 0.05}s` } as React.CSSProperties} → 保留（CSS 变量动态值，Phase 6 白名单）
style={{ width: `${60 + Math.random() * 30}%` }} → 保留（随机动态值，Phase 6 白名单）
```

- [ ] **Task 2.30: 替换 `WorkstationPage.tsx` 的剩余 inline style**

```tsx
// 第 53 行
style={{ paddingBottom: 28 }} → className="pb-7"
// 第 116 行 — animation 是条件动态值，保留
style={{ paddingBottom: 30, animation: activeTab !== prevTab ? 'wstaFadeSlideIn 0.2s ease' : undefined }}
→ paddingBottom 30px 不是标准 spacing token，用 className="pb-[30px]"，animation 保留
```

```tsx
// 改后
<div className="flex-1 min-h-0 overflow-hidden bg-[var(--color-surface)] pb-[30px]" style={{ animation: activeTab !== prevTab ? 'wstaFadeSlideIn 0.2s ease' : undefined }}>
```

- [ ] **Task 2.31: 替换 `App.tsx` 的 skip-link inline style**

```tsx
// 改前
<a className="skip-link" href="#main-content" style={{
  position: 'absolute', top: '-100%', left: 8, zIndex: 9999,
  padding: '8px 16px', background: '#6366f1', color: '#fff',
  borderRadius: '0 0 6px 6px', fontSize: 14, textDecoration: 'none',
}}>
// 改后
<a className="skip-link" href="#main-content">
```

保留 `.skip-link` 在 `reset.css` 中的已有样式（已包含 `position: absolute; top: -100%; left: 8px; z-index: var(--z-tooltip); padding: 8px 16px;` 等）。

但 `#6366f1` 颜色未使用 CSS 变量，改为已有 `var(--color-accent)`。在 `reset.css` 中确认 `.skip-link` 已有 `background: var(--color-accent)`。

**说明**：`reset.css` 第 63-69 行已有 `.skip-link` 样式，但缺少 `color`，追加 `color: var(--color-text-on-accent)` 即可。App.tsx 中只需保留 `className="skip-link"`，删除 `style` 属性。`onFocus`/`onBlur` 中对 `(e.target as HTMLElement).style.top` 的 JS 操作保留（运行时动态值，不属于静态 inline style）。

- [ ] **对各文件逐一遍执行 `npm run build` 验证**

- [ ] **提交**（建议逐文件或每 5 个文件一个 commit）

---

### Phase 3: Modal 宽度统一（~8 处，7 个文件）

#### Task 3.1: 替换 AgentFormModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/agent/AgentFormModal.tsx`

- [ ] **将 style={{ maxWidth: 640 }} 替换为 className="max-w-[640px]"**

```tsx
// 改前
style={{ maxWidth: 640 }}
// 改后
className="max-w-[640px]"
```

#### Task 3.2: 替换 SkillFormModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx`

同上，`maxWidth: 640` → `className="max-w-[640px]"`

#### Task 3.3: 替换 ToolFormModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx`

`maxWidth: 560` → `className="max-w-[560px]"`

#### Task 3.4: 替换 PromptFormModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/prompt/PromptFormModal.tsx`

`maxWidth: 560` → `className="max-w-[560px]"`

#### Task 3.5: 替换 OutputFormModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/output/OutputFormModal.tsx`

`maxWidth: 540` → `className="max-w-[540px]"`

#### Task 3.6: 替换 MCPFormModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx`

`maxWidth: 560` → `className="max-w-[560px]"`

#### Task 3.7: 替换 DeleteConfirmModal.tsx + BatchDeleteModal.tsx 的 maxWidth

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/shared/DeleteConfirmModal.tsx`
- Modify: `frontend/src/components/AgentStudio/workstation/shared/BatchDeleteModal.tsx`

`maxWidth: 420` → `className="max-w-[420px]"`

- [ ] **整体构建验证**

```bash
npm run build
```
Expected: 所有 Modal 打开时宽度不变。

- [ ] **提交**

```bash
git add frontend/src/components/AgentStudio/workstation/agent/AgentFormModal.tsx frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx frontend/src/components/AgentStudio/workstation/prompt/PromptFormModal.tsx frontend/src/components/AgentStudio/workstation/output/OutputFormModal.tsx frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx frontend/src/components/AgentStudio/workstation/shared/DeleteConfirmModal.tsx frontend/src/components/AgentStudio/workstation/shared/BatchDeleteModal.tsx
git commit -m "refactor(css): replace modal maxWidth inline styles with Tailwind classes"
```

---

### Phase 4: LoginModal + ForgotPasswordForm 重构

#### Task 4.1: 新建 `styles/auth/login.css`

**Files:**
- Create: `frontend/src/styles/auth/login.css`
- Modify: `frontend/src/main.tsx`

- [ ] **创建 `login.css`，从 LoginModal 和 ForgotPasswordForm 提取 CSS class**

创建 `frontend/src/styles/auth/login.css`：

```css
/* ── LoginModal / ForgotPasswordForm 共享样式 ── */

.login-container {
  width: 90%;
  max-width: 400px;
  max-height: 85vh;
  overflow: hidden;
}

.login-header-centered {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--color-border);
}

.login-header-centered h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.login-close-absolute {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.login-close-absolute:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

.login-body-padded {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.login-form-group {
  position: relative;
  margin-bottom: 14px;
}

.login-input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
  pointer-events: none;
  z-index: 1;
}

.login-input-field {
  width: 100%;
  height: 44px;
  padding: 0 12px 0 40px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}

.login-input-field:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.login-input-field::placeholder {
  color: var(--color-text-muted);
}

.login-btn-primary {
  width: 100%;
  height: 44px;
  background: var(--color-accent);
  border: none;
  border-radius: 10px;
  color: var(--color-text-on-accent);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.login-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-btn-text {
  background: none;
  border: none;
  color: var(--color-accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  text-decoration: none;
}

.login-btn-text:hover {
  text-decoration: underline;
}

.login-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
}

.login-divider-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.login-divider-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.login-social-btns {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}

.login-error-text {
  font-size: 11px;
  color: var(--color-danger);
  margin-top: 4px;
}

.login-hint-text {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
  opacity: 0.6;
}

.login-success-icon {
  text-align: center;
  padding-top: 28px;
  padding-bottom: 4px;
}

.login-success-icon span:first-child {
  font-size: 40px;
  margin-bottom: 12px;
}

.login-success-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}

.login-success-text {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
}

.login-success-desc {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0 0 20px;
}
```

- [ ] **在 `main.tsx` 中添加 import**

```tsx
import './styles/auth/login.css';
```

放在 `import './styles/modals/index.css';` 之后。

#### Task 4.2: 重构 LoginModal.tsx

**Files:**
- Modify: `frontend/src/components/auth/LoginModal.tsx`

- [ ] **逐一将 LoginModal.tsx 中的 inline style 替换为新 CSS class**

关键映射（每个 style={} 替换为 className）：

| style 内容 | className |
|---|---|
| `maxWidth: 400, padding: 0, overflow: 'hidden'` | 无需（已移入 `.login-container`） |
| `justifyContent: 'center', position: 'relative'` | `login-header-centered` |
| `position: 'absolute', right: 16, top: '50%'` | `login-close-absolute` |
| `padding: 24` (内层 div) | `login-body-padded` |
| `position: 'relative', marginBottom: 14` | `login-form-group` |
| 各 inputStyle 调用 | `login-input-field` (加 icon wrapper = `login-input-icon`) |
| 各 btnStyle 调用 | `login-btn-primary` |
| `fontSize: 20, fontWeight: 700, letterSpacing` | `login-success-title` |
| `fontSize: 15, fontWeight: 600, margin: '0 0 8px'` | `login-success-text` |
| `fontSize: 13, color: 'var(--color-text-tertiary)', margin: '0 0 20px'` | `login-success-desc` |
| `fontSize: 11, color: 'var(--color-text-tertiary)'` | `login-hint-text` |
| `fontSize: 11, color: 'var(--color-danger)'` | `login-error-text` |
| `display: 'flex', gap: 8` | tailwind `flex gap-2` |
| `flex: 1, height: 1, background: 'var(--color-border)'` | `login-divider-line` |
| `fontSize: 12, color: 'var(--color-text-tertiary)', flexShrink: 0` | `login-divider-text` |
| `display: 'flex', justifyContent: 'center', gap: 12` | `login-social-btns` |

- [ ] **确保原有的 `inputStyle`、`btnStyle`、`iconBase` 对象被移除**

- [ ] **验证**

```bash
npm run build
```
然后肉眼确认：登录弹窗打开、切换步骤、明暗主题切换，所有视觉效果不变。

#### Task 4.3: 重构 ForgotPasswordForm.tsx

**Files:**
- Modify: `frontend/src/components/auth/ForgotPasswordForm.tsx`

- [ ] **将 ForgotPasswordForm.tsx 中的 inline style 替换为 `.login-*` CSS class**

使用与 LoginModal 相同的 class 命名体系：
```
style={{ textAlign: 'center', padding: '20px 0' }} → className="text-center py-5"
style={{ fontSize: 40, marginBottom: 12 }} → className="text-[40px] mb-3"
style={{ fontSize: 15, fontWeight: 600, margin: '0 0 8px' }} → login-success-text
style={{ fontSize: 13, color: 'var(--color-text-tertiary)', margin: '0 0 20px' }} → login-success-desc
style={btnStyle} → login-btn-primary
style={inputStyle} → login-input-field
style={{ fontSize: 13, color: 'var(--color-danger)', marginTop: 4 }} → login-error-text
style={{ ...inputStyle, marginTop: 12 }} → login-input-field mt-3
```

- [ ] **验证**

```bash
npm run build
```

- [ ] **提交 Phase 4 所有改动**

```bash
git add frontend/src/styles/auth/ frontend/src/main.tsx frontend/src/components/auth/LoginModal.tsx frontend/src/components/auth/ForgotPasswordForm.tsx
git commit -m "refactor(css): extract LoginModal and ForgotPasswordForm styles to auth/login.css"
```

---

### Phase 5: WorkflowEditor 硬编码色值替换

#### Task 5.1: 替换 WorkflowEditor.tsx 中的硬编码颜色

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx`

- [ ] **逐一替换硬编码色值**

```tsx
// 第 70-71 行：节点背景和边框
// 改前
border: `2px solid ${selected ? '#3b82f6' : '#e5e7eb'}`,
background: '#fff',
// 改后
border: `2px solid ${selected ? 'var(--color-accent)' : 'var(--color-border)'}`,
background: 'var(--color-surface-card)',

// 第 74 行：阴影
// 改前
boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
// 改后
boxShadow: selected ? '0 0 0 3px color-mix(in srgb, var(--color-accent) 20%, transparent)' : 'var(--shadow-sm)',

// 第 80 行：Handle 颜色
// 改前
style={{ background: '#94a3b8' }}
// 改后
style={{ background: 'var(--color-border-strong)' }}

// 第 104 行
// 改前
style={{ background: '#94a3b8' }}
// 改后
style={{ background: 'var(--color-border-strong)' }}

// 第 116 行：删除按钮背景
// 改前
background: '#ef4444',
// 改后
background: 'var(--color-danger)',

// 第 117 行：删除按钮文字
// 改前
color: '#fff',
// 改后
color: 'var(--color-text-on-accent)',

// 第 118 行：删除按钮边框
// 改前
border: '2px solid #fff',
// 改后
border: '2px solid var(--color-surface-card)',

// 第 141-142 行：下拉菜单
// 改前
background: '#fff',
border: '1px solid #e5e7eb',
// 改后
background: 'var(--color-surface-overlay)',
border: '1px solid var(--color-border)',

// 第 314-316 行：input 宽度
// 改前
style={{ width: 200 }} → className="w-[200px]"
style={{ width: 60 }} → className="w-[60px]"

// 第 321 行：删除工作流按钮
// 改前
style={{ color: '#ef4444', marginLeft: 'auto' }}
// 改后
className="ml-auto" 和 style={{ color: 'var(--color-danger)' }}
→ className="ml-auto text-[var(--color-danger)]"

// 第 333-334 行：辅助文字
// 改前
style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}
// 改后
className="text-xs text-[var(--color-text-tertiary)] ml-2"

// 第 334 行：kbd 样式
// 改前
style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb' }}
// 改后
className="bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded border border-[var(--color-border)]"

// 第 338 行：画布容器
// 改前
style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8 }}
// 改后 （rounded-md = 8px, 与 --radius-md 一致）
className="flex-1 border border-[var(--color-border)] rounded-md"
```

- [ ] **验证**

```bash
npm run build
```
然后在明暗两种主题下肉眼确认 WorkflowEditor 颜色正常。

- [ ] **提交**

```bash
git add frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx
git commit -m "refactor(css): replace hardcoded colors in WorkflowEditor with CSS variables"
```

---

### Phase 6: 白名单注释确认

#### Task 6.1: 为保留的 inline style 加注释

**Files:**
- Modify: `frontend/src/components/AgentStudio/messages/CodeBlock.tsx`
- Modify: `frontend/src/components/AgentStudio/workstation/team/TeamMemberManager.tsx`
- Modify: `frontend/src/components/AgentStudio/workstation/shared/WstaDropdownPortal.tsx`
- Modify: `frontend/src/components/AgentStudio/workstation/shared/LoadingSkeleton.tsx`
- Modify: `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx`
- Modify: `frontend/src/components/AgentStudio/WorkstationPage.tsx`

- [ ] **为每个保留的 inline style 添加 `// style-skip-migration` 注释**

```tsx
// CodeBlock.tsx — oneDark 是第三方样式对象
style={oneDark} // style-skip-migration: third-party syntax highlighter style object

// TeamMemberManager.tsx — animationDelay 是循环生成值
style={{ animation: ..., animationDelay: `${idx * 30}ms` }} // style-skip-migration: runtime computed value

// WstaDropdownPortal.tsx — 位置根据触发元素动态计算
style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }} // style-skip-migration: dynamic position

// LoadingSkeleton.tsx — 随机宽度
style={{ width: `${60 + Math.random() * 30}%` }} // style-skip-migration: random width
// CSS 变量传递
style={{ '--sk-delay': ... }} // style-skip-migration: dynamic CSS variable

// WorkflowEditor.tsx — Handle 颜色是 ReactFlow 必须的 style
style={{ background: 'var(--color-border-strong)' }} // ReactFlow Handle requires style

// WorkstationPage.tsx — 条件动画
style={{ animation: activeTab !== prevTab ? 'wstaFadeSlideIn 0.2s ease' : undefined }} // style-skip-migration: conditional animation
```

- [ ] **无代码改动，仅加注释，直接 `npm run build` 验证**

- [ ] **提交**

```bash
git add frontend/src/components/AgentStudio/messages/CodeBlock.tsx frontend/src/components/AgentStudio/workstation/team/TeamMemberManager.tsx frontend/src/components/AgentStudio/workstation/shared/WstaDropdownPortal.tsx frontend/src/components/AgentStudio/workstation/shared/LoadingSkeleton.tsx frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx frontend/src/components/AgentStudio/WorkstationPage.tsx
git commit -m "chore(css): add style-skip-migration annotations for unavoidable inline styles"
```

---

## Phase 完成后全体验证

每 Phase 完成后执行：

```bash
npm run build
# 无 error
npm run lint
# 无新增 warning
```

并在浏览器中确认：
- 明色主题：所有页面正常
- 暗色主题：所有页面正常
- 每个 Modal 打开/关闭正常
- WorkflowEditor 节点显示正常

## 回滚策略

每个 Phase 独立提交。回滚命令：

```bash
# 回滚单个 Phase
git log --oneline -10
git revert <commit-hash>

# 不影响其他 Phase 的改动
```
