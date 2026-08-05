# UI 缺陷修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复全应用 55+ 个 UI 缺陷，覆盖全局 Token、侧边栏、弹窗系统、消息面板、Workspace、WorkstationPage。

**Architecture:** 4 个 Phase 串行（Phase 0 全局 Token → Phase 1 侧边栏 → Phase 2 弹窗 → Phase 3/4 剩余组件），每 Phase 内可并行。

**Tech Stack:** React 18 + Tailwind v4 + CSS Variables + Motion + lucide-react

---

## Phase 0 — 全局 Token 修复

### Task 0.1: 统一字号体系 + 调整根 font-size

**Files:**
- Modify: `frontend/src/styles/tailwind-entry.css`
- Modify: `frontend/src/styles/base/reset.css`

- [ ] **Step 1: 修改 reset.css html font-size**

将 `html, body { font-size: var(--da-font-size-base); }` 拆开，html 用 16px，body 用 14px。

```css
/* reset.css */
html {
  font-size: 16px;  /* 浏览器默认，rem 基准恢复 */
}
body {
  font-size: 14px;  /* 视觉基准字号 */
  /* 其余不变 */
}
```

- [ ] **Step 2: 更新 tailwind-entry.css @theme 字号 Token**

```css
/* tailwind-entry.css @theme 块 */
--text-xs: 11px;    /* 辅助标签 */
--text-sm: 13px;    /* 按钮、列表项 */
--text-base: 14px;  /* 正文 */
--text-lg: 16px;    /* 小标题 */
--text-xl: 20px;    /* 弹窗标题 */
--text-2xl: 24px;   /* 页面大标题 */
```

- [ ] **Step 3: 移除 --da-font-size-* 自定义变量**

从 `tailwind-entry.css` 移除：
```
--da-font-size-base: 15px;
--da-font-size-sm: 13px;
--da-font-size-xs: 11px;
--da-font-size-lg: 17px;
--da-font-size-xl: 22px;
```

- [ ] **Step 4: 搜索全局硬编码字号并替换**

```bash
# 搜索所有 text-[Npx] 硬编码字号，替换为 Tailwind token
# text-[15px] → text-base (14px) 或 text-sm (13px)
# text-[11px] → text-xs (11px)
# text-[12.5px] → text-xs (11px) 或 text-sm (13px)
# text-[17px] → text-lg (16px)
```

涉及文件：
- `AgentStudioSidebar.tsx:104` — `text-[15px]` → `text-base`
- `TeamTree.tsx:176,144` — `text-[11px]` → `text-xs`
- `ConversationsList.tsx:162` — `text-[11px]` → `text-xs`
- `WorkstationPage.tsx:29` — `text-[10px]` → `text-xs`
- `TeamMessage.tsx:241` — `text-[12.5px]` → `text-xs`
- `WorkstationPage.tsx:51` — `text-[17px]` → `text-lg`
- `AgentConfigModal.tsx:161` — `var(--da-font-size-lg)` → `text-lg`
- `AgentConfigModal.tsx:162` — `var(--da-font-size-xs)` → `text-xs`
- `UserMenu.tsx:140` — `var(--da-font-size-sm)` → `text-sm`
- `UserMenu.tsx:143` — `var(--da-font-size-xs)` → `text-xs`
- `SettingsModal.tsx` — 所有 `fontSize` 内联样式 → Tailwind 类

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/tailwind-entry.css frontend/src/styles/base/reset.css
# 加上已修改的组件文件
git commit -m "fix(ui): unify font-size system, set html:16px body:14px, remove da-font-size tokens"
```

### Task 0.2: 修复 text-tertiary 对比度

**Files:**
- Modify: `frontend/src/styles/tailwind-entry.css`

- [ ] **Step 1: 修改暗色主题的 --color-text-tertiary**

```css
/* tailwind-entry.css 暗色块 (:root, 第 52 行) */
--color-text-tertiary: #9ca3af;  /* 从 #6b7280 改为 #9ca3af */
```

- [ ] **Step 2: 验证对比度**

```bash
# 验证 #9ca3af 在 #111318 上的对比度 ≈ 5.2:1（满足 WCAG AA 4.5:1）
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/tailwind-entry.css
git commit -m "fix(a11y): raise text-tertiary contrast from 3.57:1 to 5.2:1 in dark mode"
```

### Task 0.3: 提升 hover 可见度

**Files:**
- Modify: `frontend/src/styles/tailwind-entry.css`

- [ ] **Step 1: 修改 hover 透明度**

```css
/* tailwind-entry.css 暗色块 */
--color-surface-hover: rgba(255, 255, 255, 0.08);  /* 从 0.06 提升到 0.08 */
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/tailwind-entry.css
git commit -m "fix(ui): increase hover visibility from 6% to 8% overlay"
```

### Task 0.4: 修复 App.tsx 未定义变量引用

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 替换遗留变量**

```tsx
// Fallback 组件 (第 24 行)
// var(--da-text-muted) → var(--color-text-muted)
// var(--da-bg-hover) → var(--color-surface-hover)
// var(--da-bg-elevated) → var(--color-surface-elevated)

// loadingScreenStyle (第 39-46 行)
// var(--da-bg-primary, #0f1117) → var(--color-surface, #0f1117)
// var(--da-text-secondary, #888) → var(--color-text-secondary, #888)
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "fix(ui): replace undefined da-* CSS variable references with color-* equivalents"
```

### Task 0.5: 修复滚动条轨道色

**Files:**
- Modify: `frontend/src/styles/base/scrollbar.css`

- [ ] **Step 1: 修改轨道色**

```css
/* scrollbar.css */
::-webkit-scrollbar-track {
  background: var(--color-surface-sidebar);  /* 从 --color-surface-raised 改为 --color-surface-sidebar */
}
* {
  scrollbar-color: var(--color-border) var(--color-surface-sidebar);  /* 同上 */
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/base/scrollbar.css
git commit -m "fix(ui): match scrollbar track color to sidebar background"
```

---

## Phase 1 — 侧边栏修复

### Task 1.1: 重设"新建对话"按钮尺寸 + 对齐

**Files:**
- Modify: `frontend/src/components/AgentStudio/AgentStudioSidebar.tsx`

- [ ] **Step 1: 修改按钮容器 padding**

```tsx
{/* 第 116 行 */}
<div className="px-4 pb-3 shrink-0">  {/* px-3 → px-4 (12→16px) */}
```

- [ ] **Step 2: 修改按钮尺寸**

```tsx
{/* 第 117 行 */}
<button className="... gap-2 py-2.5 px-3 ...">  {/* py-2 → py-2.5 (8→10px) */}
  <Sparkles size={14} ... />  {/* size={16} → size={14} */}
  <span>{t('sidebar.newChat')}</span>
</button>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AgentStudio/AgentStudioSidebar.tsx
git commit -m "fix(ui): resize new-chat button to 40px height, match icon to text size, increase side margin"
```

### Task 1.2: 放大触摸目标

**Files:**
- Modify: `frontend/src/components/AgentStudio/sidebar/TeamTree.tsx`
- Modify: `frontend/src/components/AgentStudio/sidebar/TeamTreeAgentItem.tsx`

- [ ] **Step 1: 放大 TeamTree 折叠箭头**

```tsx
{/* TeamTree.tsx 第 192 行 */}
<button className="... w-[22px] h-[22px] ...">  {/* w-[18px] h-[18px] → w-[22px] h-[22px] */}
  <ChevronDown size={14} />
</button>
```

- [ ] **Step 2: 放大 TeamTree 更多按钮**

```tsx
{/* TeamTree.tsx 第 222 行 */}
<button className="... w-[24px] h-[24px] ...">  {/* w-[22px] h-[22px] → w-[24px] h-[24px] */}
```

- [ ] **Step 3: 放大 AgentItem 更多按钮**

```tsx
{/* TeamTreeAgentItem.tsx 第 78 行 */}
<button className="... w-[24px] h-[24px] ...">  {/* w-[22px] h-[22px] → w-[24px] h-[24px] */}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AgentStudio/sidebar/TeamTree.tsx frontend/src/components/AgentStudio/sidebar/TeamTreeAgentItem.tsx
git commit -m "fix(ui): increase touch targets to WCAG minimum 24px for sidebar controls"
```

### Task 1.3: 修复 Virtuoso 嵌套滚动

**Files:**
- Modify: `frontend/src/components/AgentStudio/AgentStudioSidebar.tsx`

- [ ] **Step 1: 移除父容器的 overflow-y-auto**

```tsx
{/* 第 124 行 */}
<div className="flex-1 px-3 flex flex-col gap-4">  {/* 移除 overflow-y-auto */}
```

将 `overflow-y-auto` 移到 ConversationsList 内部的 Virtuoso 上，或让 Virtuoso 的容器自己管理滚动。

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/AgentStudioSidebar.tsx
git commit -m "fix(ui): remove nested scroll context between virtuoso and parent container"
```

### Task 1.4: 修复对齐 + 统一间距

**Files:**
- Modify: `frontend/src/components/AgentStudio/sidebar/TeamTree.tsx`
- Modify: `frontend/src/components/AgentStudio/sidebar/ConversationsList.tsx`

- [ ] **Step 1: TeamTree 列表项对齐**

```tsx
{/* TeamTree.tsx 第 190 行 */}
<div className="group flex items-center gap-[6px] py-1.5 pl-2 pr-[32px] ...">  {/* py-[6px] → py-1.5, pl-[6px] → pl-2 */}
```

- [ ] **Step 2: ConversationsList 对齐**

```tsx
{/* ConversationsList.tsx 第 96 行 */}
<div className="group flex items-center justify-between py-1.5 px-2 rounded-r-md ...">  {/* py-2 → py-1.5 */}
```

- [ ] **Step 3: 激活态 border 占位**

```tsx
{/* ConversationsList.tsx 第 96 行，非激活态 */}
className="group flex items-center justify-between py-1.5 px-2 rounded-r-md cursor-pointer transition-colors duration-150 gap-2 hover:bg-[var(--color-surface-hover)] border-l-2 border-l-transparent"
{/* 非激活态也保留 border-l-2 border-l-transparent，防止 2px 宽度跳动 */}
```

- [ ] **Step 4: 非激活态 border 占位**

激活态 class：
```tsx
${isActive ? 'bg-[var(--color-accent)]/8 !border-l-[var(--color-accent)]' : ''}
```

保持非激活的 `border-l-2 border-l-transparent` 始终存在。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/sidebar/TeamTree.tsx frontend/src/components/AgentStudio/sidebar/ConversationsList.tsx
git commit -m "fix(ui): unify sidebar item alignment and spacing, prevent active-state width shift"
```

### Task 1.5: TeamTree 空状态

**Files:**
- Modify: `frontend/src/components/AgentStudio/sidebar/TeamTree.tsx`

- [ ] **Step 1: 添加空状态**

在 TeamTree 的 team map 之前或者之后添加：

```tsx
{/* TeamTree.tsx，在 header 之后、teams.map 之前 */}
{teams.length === 0 && (
  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
    <p className="text-xs text-[var(--color-text-muted)] m-0">
      {t('sidebar.noTeams', '暂无团队，点击 + 创建')}
    </p>
  </div>
)}
```

确保 i18n 翻译文件 (`zh-CN/sidebar.json`, `en-US/sidebar.json`) 中有 `noTeams` 条目：
```json
{
  "sidebar": {
    "noTeams": "暂无团队，点击 + 创建",
    ...
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/sidebar/TeamTree.tsx frontend/src/i18n/locales/*/sidebar.json
git commit -m "feat(ui): add empty state for team tree when no teams exist"
```

### Task 1.6: UserMenu 定位修复 + Agent 数量徽标 + 移除死代码

**Files:**
- Modify: `frontend/src/components/AgentStudio/sidebar/UserMenu.tsx`
- Modify: `frontend/src/components/AgentStudio/sidebar/TeamTree.tsx`
- Modify: `frontend/src/components/AgentStudio/sidebar/ConversationsList.tsx`

- [ ] **Step 1: UserMenu 定位**

```tsx
{/* UserMenu.tsx 第 75 行 */}
className="absolute bottom-[calc(100%+8px)] left-3 right-3 ..."  {/* left: 3→3(12px), right: 3→3(12px) */}
```

改为：
```tsx
className="absolute bottom-[calc(100%+8px)] left-3 right-3 ..."
/* left-3 已经是 12px（16px root），符合规范 */
```

当前代码已经使用 `left-3 right-3`，在 16px 根字号下 `left-3` = 12px。这不需修改—之前的 issue 报告中的 `left: 3px` 实际上已经是 Tailwind class。

- [ ] **Step 2: Agent 数量徽标**

```tsx
{/* TeamTree.tsx 第 220 行 */}
<span className="text-[11px] text-[var(--color-text-tertiary)] flex-shrink-0 font-normal opacity-70 min-w-fit px-1 text-right">
{/* min-w-[14px] → min-w-fit px-1 */}
```

- [ ] **Step 3: 移除 ConversationsList 未使用的 pinned 分组**

```tsx
{/* ConversationsList.tsx 第 27 行，移除 pinned */}
const groups = {
  // pinned: [] as Conversation[],  ← 移除
  today: [] as Conversation[],
  ...
};
```

以及任何引用 `groups.pinned` 的地方。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AgentStudio/sidebar/UserMenu.tsx frontend/src/components/AgentStudio/sidebar/TeamTree.tsx frontend/src/components/AgentStudio/sidebar/ConversationsList.tsx
git commit -m "fix(ui): fix agent count badge, remove unused pinned group in conversations"
```

---

## Phase 2 — 弹窗系统统一

### Task 2.1: 弹窗按钮高度统一

**Files:**
- Modify: `frontend/src/styles/modals/buttons.css`

- [ ] **Step 1: 修改按钮高度**

```css
/* buttons.css */
.agentstudio-modal-btn {
  min-width: 68px;
  height: 36px;        /* 34px → 36px */
  padding: 0 15px;
  /* 其余不变 */
}
```

- [ ] **Step 2: 检查 SettingsModal/ApiManagementModal 中的按钮**

SettingsModal 使用 `Modal` 组件的 `footer` prop，按钮是行内 JSX。如果有固定高度类，改为 `h-9`（即 36px）。
ApiManagementModal 同理。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/modals/buttons.css
git commit -m "fix(ui): standardize modal button height to 36px minimum"
```

### Task 2.2: 修复 SettingsModal + ApiManagementModal 的 active tab 样式

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/SettingsModal.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/ApiManagementModal.tsx`

- [ ] **Step 1: 统一添加 active 样式类**

两处弹窗的左侧导航 tab 按钮添加条件类：

```tsx
{/* SettingsModal.tsx 第 50 行 */}
className={`flex items-center gap-3 p-2 px-3 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] text-sm cursor-pointer transition-[background,color] duration-150 text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] ${activeTab === tab ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] [&_svg]:text-[var(--color-accent)] [&_svg]:opacity-100' : '[&_svg]:opacity-60'}`}
```

- [ ] **Step 2: ApiManagementModal 相同修改**

```tsx
{/* ApiManagementModal.tsx 第 211 行 — 相同的修改 */}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/SettingsModal.tsx frontend/src/components/AgentStudio/modals/ApiManagementModal.tsx
git commit -m "fix(ui): add active tab indicator for settings and api modals nav sidebars"
```

### Task 2.3: SettingsModal About 页内联样式迁移

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/SettingsModal.tsx`

- [ ] **Step 1: 迁移 About 页的 style={{}} 为 Tailwind 类**

```tsx
{/* 原有 80 行内联样式，全部替换 */}

{/* App identity card (第 165-200 行) */}
{/* 原 style 代码 */}
<div style={{
  display: 'flex', alignItems: 'center', gap: 16,
  padding: '24px 20px', width: '100%',
  background: 'color-mix(...)',
  border: '1px solid var(--color-border)',
  borderRadius: 10, marginBottom: 16,
}}>
  <div style={{ width: 52, height: 52, borderRadius: 14, ... }}>
```

改为：
```tsx
<div className="flex items-center gap-4 px-5 py-6 w-full rounded-lg border border-[var(--color-border)] mb-4"
     style={{ background: 'color-mix(in srgb, var(--color-surface), var(--color-text-primary) 3%)' }}>
  <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center shrink-0"
       style={{
         background: 'linear-gradient(135deg, ...)',
         color: 'var(--color-accent)',
         boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 20%, transparent)',
       }}>
    <Info size={24} />
  </div>
  <div>
    <div className="text-lg font-semibold text-[var(--color-text-primary)] tracking-tight">
      AgentStudio
    </div>
    ...
  </div>
</div>

{/* 信息网格 */}
<div className="grid grid-cols-2 gap-[1px] w-full border border-[var(--color-border)] rounded-lg overflow-hidden"
     style={{ background: 'var(--color-border)' }}>
  {infos.map(...)}
</div>

{/* Footer 注释 */}
<div className="w-full mt-4 text-xs text-[var(--color-text-muted)] text-center opacity-70 leading-relaxed">
  AI Agent 协作系统 — 基于 LangGraph 多智能体编排
</div>
```

`gradient` 和 `color-mix` 这种 Tailwind 不原生支持的保留 `style={{}}`，其余全部 Tailwind。

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/SettingsModal.tsx
git commit -m "refactor(ui): migrate SettingsModal about tab from inline styles to Tailwind classes"
```

### Task 2.4: ApiManagementModal 删除改用 ConfirmModal

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/ApiManagementModal.tsx`

- [ ] **Step 1: 引入 ConfirmModal 状态**

```tsx
// 添加状态
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
```

- [ ] **Step 2: 替换 confirm()**

```tsx
// 原 handleDeleteKey（第 142-153 行）
const handleDeleteKey = async (id: string) => {
  if (!confirm('确定要删除此 API Key 吗？此操作不可撤销。')) return;
  // ...
};

// 改为
const handleDeleteKey = (id: string) => {
  setConfirmDeleteId(id);
};

const confirmDeleteAction = async () => {
  if (!confirmDeleteId) return;
  setError(null);
  try {
    await api.deleteKey(confirmDeleteId);
    await loadKeys();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : t('api.deleteFailed');
    setError(msg);
  }
  setConfirmDeleteId(null);
};
```

- [ ] **Step 3: 在 JSX 中添加 ConfirmModal**

```tsx
{/* 在 return 末尾，ProviderEditModal 之前或之后 */}
{confirmDeleteId && (
  <ConfirmModal
    title={t('confirm.title')}
    message={t('api.deleteKeyConfirm')}
    onConfirm={confirmDeleteAction}
    onCancel={() => setConfirmDeleteId(null)}
    danger
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ApiManagementModal.tsx
git commit -m "fix(ui): replace native confirm() with custom ConfirmModal for API key deletion"
```

### Task 2.5: 字体滑块 CSS 提取

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/SettingsModal.tsx`
- Modify: `frontend/src/styles/workstation/ant-overrides.css`（或 `modals` 下新建）

- [ ] **Step 1: 添加 CSS 类**

在 `frontend/src/styles/modals/` 下新建 `range-slider.css` 或添加到现有 CSS 文件：

```css
/* range-slider.css */
.settings-font-slider {
  width: 120px;
  height: 6px;
  border-radius: 3px;
  appearance: none;
  cursor: pointer;
}
.settings-font-slider:focus-visible {
  outline: none;
}
.settings-font-slider::-webkit-slider-runnable-track {
  appearance: none;
  height: 6px;
  background: transparent;
}
.settings-font-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  margin-top: -5px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.settings-font-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--color-accent), 0 1px 4px rgba(0,0,0,0.3);
}
.settings-font-slider::-moz-range-track {
  height: 6px;
  border-radius: 3px;
  border: none;
  background: var(--color-surface-hover);
}
.settings-font-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  border: none;
  cursor: pointer;
}
.settings-font-slider:focus-visible::-moz-range-thumb {
  box-shadow: 0 0 0 2px var(--color-accent);
}
.settings-font-slider::-moz-range-progress {
  height: 6px;
  border-radius: 3px;
  background: var(--color-accent);
}
```

- [ ] **Step 2: 简化 JSX**

```tsx
{/* SettingsModal.tsx 第 112 行 */}
<input
  type="range"
  min="12" max="16" step="1"
  value={settings.fontSize}
  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
  style={{ background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${fontPct}%, var(--color-surface-hover) ${fontPct}%, var(--color-surface-hover) 100%)` }}
  className="settings-font-slider"  {/* 替换所有 arbitrary variants */}
/>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/modals/range-slider.css frontend/src/components/AgentStudio/modals/SettingsModal.tsx
git commit -m "refactor(ui): extract font-size slider CSS from JSX to dedicated stylesheet"
```

### Task 2.6: 原生 checkbox 样式

**Files:**
- Modify: `frontend/src/styles/modals/buttons.css`（或新建文件）

- [ ] **Step 1: 添加 checkbox accent-color**

```css
/* buttons.css 或 agent.css 或新建 */
.agent-config-list input[type="checkbox"] {
  accent-color: var(--color-accent);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/modals/buttons.css
git commit -m "fix(ui): style config list checkbox with brand accent color"
```

---

## Phase 3 — 剩余组件修复

### Task 3.1: Header 主题切换支持 system

**Files:**
- Modify: `frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx`

- [ ] **Step 1: 修改 theme toggle 逻辑**

```tsx
{/* 第 75 行 */}
// 当前：light/dark 两档切换
// 改为：system 模式下点第一下进 dark，再点 light，再点 system...

// 更简单的方案：useSettings 的 settings.theme 已经在 SettingsModal 中支持三档
// header toggle 只做 light/dark 切换，保留 system 在设置页设置
// 但需要读取当前有效主题

// 当前逻辑：
onClick={() => s.updateSettings({ theme: s.isDarkMode ? 'light' : 'dark' })}
// 这忽略 system 模式。改为：
onClick={() => {
  // 如果当前是 system，根据 prefers-color-scheme 判断当前实际主题
  if (s.settings.theme === 'system') {
    s.updateSettings({ theme: 'dark' });
  } else {
    s.updateSettings({ theme: s.isDarkMode ? 'light' : 'dark' });
  }
}}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx
git commit -m "fix(ui): header theme toggle respects system preference mode"
```

### Task 3.2: 消息区 max-width 弹性化

**Files:**
- Modify: `frontend/src/components/AgentStudio/MessagesPanel.tsx`

- [ ] **Step 1: 修改 max-width**

```tsx
{/* 第 71 行和第 116 行 */}
<div className="max-w-[min(900px,85vw)] mx-auto w-full flex flex-col gap-6 px-6 py-6 pb-12">
  {/* max-w-[900px] → max-w-[min(900px,85vw)] */}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/MessagesPanel.tsx
git commit -m "fix(ui): make message panel responsive with max(900px,85vw)"
```

### Task 3.3: 消息操作按钮触摸目标修复

**Files:**
- Modify: `frontend/src/components/AgentStudio/TeamMessage.tsx`

- [ ] **Step 1: 版本切换按钮**

```tsx
{/* 第 341 行 */}
<button className="flex items-center justify-center w-6 h-6 ...">  {/* w-5 h-5 → w-6 h-6 */}
  <ChevronRight size={12} className="rotate-180" />
</button>
{/* 第 350 行 — 同样的修改 */}
```

- [ ] **Step 2: 赞/踩按钮**

```tsx
{/* 第 371 行 */}
<button className="flex items-center justify-center min-w-[24px] min-h-[24px] ...">  {/* w-6 h-6 → min-w-[24px] min-h-[24px] */}
```

- [ ] **Step 3: 复制/编辑/重新生成按钮**

```tsx
{/* 第 128 行 — CopyBtn */}
{/* CopyBtn 组件内部 px-1 py-0.5 → px-1.5 py-1 */}

{/* 第 130 行 — 编辑按钮 */}
<button className="px-1.5 py-1 ...">  {/* px-1 py-0.5 → px-1.5 py-1 */}
```

- [ ] **Step 4: 时间戳透明度移除**

```tsx
{/* 第 137 行 */}
<span className="block text-xs text-[var(--color-text-muted)] mt-1 ml-0">  {/* 移除 opacity-70 */}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/TeamMessage.tsx
git commit -m "fix(ui): increase message action touch targets, improve timestamp readability"
```

### Task 3.4: WorkstationPage 导航激活态区分

**Files:**
- Modify: `frontend/src/components/AgentStudio/WorkstationPage.tsx`

- [ ] **Step 1: 修改激活态样式**

```tsx
{/* 第 37-40 行 */}
${activeTab === tab.id
  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
  : 'bg-transparent text-[var(--color-text-secondary)] font-normal hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/WorkstationPage.tsx
git commit -m "fix(ui): differentiate active nav state from hover state with accent tint"
```

### Task 3.5: Workspace 宽度响应 + Tab 激活态

**Files:**
- Modify: `frontend/src/components/AgentStudio/workspace/Workspace.tsx`

- [ ] **Step 1: 修改宽度**

```tsx
{/* 第 30 行 */}
<aside className="w-[clamp(280px,22vw,360px)] flex flex-col ...">  {/* w-[320px] → w-[clamp(280px,22vw,360px)] */}
```

- [ ] **Step 2: 修改 tab 激活态**

```tsx
{/* 第 37 行 */}
${activeTab === tab.id
  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-medium'
  : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AgentStudio/workspace/Workspace.tsx
git commit -m "fix(ui): responsive workspace width clamp(280px,22vw,360px), unify tab active style"
```

### Task 3.6: HomeScreen 快捷按钮间距

**Files:**
- Modify: `frontend/src/components/AgentStudio/HomeScreen.tsx`

- [ ] **Step 1: 修改 py**

```tsx
{/* 第 69、79、89、99、109 行 所有快捷按钮 */}
className="inline-flex items-center gap-1.5 px-3 py-[7px] ..."  {/* py-1.5 → py-[7px] */}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/HomeScreen.tsx
git commit -m "fix(ui): increase quick action button vertical padding from 5.6px to 7px"
```

### Task 3.7: Header 通知红点定位

**Files:**
- Modify: `frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx`

- [ ] **Step 1: 用 flex 替代绝对定位**

```tsx
{/* 第 78-81 行 */}
<button className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] cursor-pointer relative transition-[color,background] duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" aria-label="Notifications">
  <Bell size={16} />
  {/* 改为 flex + self-start 定位红点在右上角 */}
  <span className="absolute -top-[2px] -right-[2px] w-2 h-2 rounded-full bg-[var(--color-danger)] border-2 border-[var(--color-surface-card)]" />
</button>
```

`-top-[2px] -right-[2px]` 相对 `top-[6px] right-2` 更不依赖按钮尺寸。

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx
git commit -m "fix(ui): improve notification dot positioning with relative offset"
```

---

## Phase 4 — 遗留清理

### Task 4.1: Header.tsx 命名清理

**Files:**
- Modify: `frontend/src/components/Header.tsx`

- [ ] **Step 1: 替换 classname**

```tsx
{/* 第 9-12 行 */}
<header className="agentstudio-header">
  <div className="agentstudio-header-left">
    <button className="agentstudio-header-btn" ...>
```

- [ ] **Step 2: 检查是否被使用**

搜索 `Header` 组件的引用，确认它是否还在使用（可能在 App.tsx 或其他文件）。如果不再使用，考虑移除整个文件。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Header.tsx
git commit -m "cleanup: rename devagents-* classes to agentstudio-*"
```

### Task 4.2: 移除死代码

**Files:**
- Modify: `frontend/src/styles/tailwind-entry.css`

- [ ] **Step 1: 移除未使用的变量**

```css
/* 从 tailwind-entry.css 移除（如 Phase 0 中未移除） */
--da-line-height: 1.6;
--da-radius: 0.5rem;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/tailwind-entry.css
git commit -m "cleanup: remove unused da-line-height and da-radius CSS variables"
```

---

## 验收检查清单

Phase 0 验收：
- [ ] `html` font-size = 16px，计算 1rem = 16px
- [ ] 无 `text-[Npx]` 硬编码字号和 `var(--da-font-size-*)` 引用
- [ ] 暗色 `--color-text-tertiary` = `#9ca3af`，对比度 ≥ 4.5:1
- [ ] `--color-surface-hover` = `rgba(255,255,255,0.08)`
- [ ] App.tsx 无 `var(--da-*)` 引用
- [ ] 滚动条轨道色匹配侧边栏背景

Phase 1 验收：
- [ ] 新建对话按钮高度 ≥ 40px，图标 14px 匹配文字
- [ ] 所有可点击元素 ≥ 24×24px
- [ ] 无 Virtuoso 嵌套滚动
- [ ] TeamTree 和 ConversationsList 左边缘对齐
- [ ] 激活态对话项不产生宽度跳动
- [ ] teams=[] 时显示空状态
- [ ] Agent 数量徽标适配双位数
- [ ] 移除 pinned 分组死代码

Phase 2 验收：
- [ ] `.agentstudio-modal-btn` 高度 36px
- [ ] SettingsModal + ApiManagementModal 左侧导航 active tab 有视觉反馈
- [ ] SettingsModal About 页无内联 `style={{}}`
- [ ] API Key 删除使用 ConfirmModal
- [ ] 字体滑块 CSS 已从 JSX 提取
- [ ] checkbox 使用 accent-color: var(--color-accent)

Phase 3 验收：
- [ ] Header 主题切换兼容 system 模式
- [ ] 消息面板 `max-width` 适配小屏
- [ ] 消息操作按钮 ≥ 24×24px
- [ ] 时间戳无 `opacity-70`
- [ ] WorkstationPage 导航激活态有视觉区分（accent tint）
- [ ] Workspace 宽度响应式 `clamp(280px, 22vw, 360px)`
- [ ] Workspace tab 激活态统一
- [ ] HomeScreen 快捷按钮 `py-[7px]`
- [ ] 通知红点定位健壮
