# Phase 2: 布局/导航/侧栏 Tailwind 替换 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 将 layout.css (948行) + sidebar/*.css (7文件, 879行) + WorkstationPage.tsx 内联样式替换为 Tailwind className

**Architecture:** 每个 CSS 文件独立替换为 Tailwind className，每完成一个 section 截图对比验证视觉一致性

**Tech Stack:** React 18 + Vite 6 + Tailwind v4 + Ant Design 5

---

## 文件变更清单

| 操作 | 文件 | 行数 | 风险 |
|------|------|------|------|
| 修改 | `frontend/src/styles/layout.css` | 948 | 高 |
| 修改/删除 | `frontend/src/styles/sidebar/logo.css` | 54 | 低 |
| 修改/删除 | `frontend/src/styles/sidebar/headers.css` | 69 | 低 |
| 修改/删除 | `frontend/src/styles/sidebar/teams.css` | 396 | 中 |
| 修改/删除 | `frontend/src/styles/sidebar/conversations.css` | 113 | 低 |
| 删除 | `frontend/src/styles/sidebar/projects.css` | 23 | 低（无对应组件）|
| 删除 | `frontend/src/styles/sidebar/usermenu.css` | 90 | 低（被 layout.css 替代）|
| 修改/删除 | `frontend/src/styles/sidebar/misc.css` | 49 | 低 |
| 修改 | `frontend/src/components/AgentStudio/WorkstationPage.tsx` | 64 | 中 |

---

### Task 1: 迁移 layout.css 布局体系为 Tailwind

**Files:**
- Modify: `frontend/src/styles/layout.css`
- Modify: `frontend/src/components/AgentStudio/AgentStudioSidebar.tsx`
- Modify: `frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx`
- Modify: `frontend/src/components/AgentStudio/HomeScreen.tsx`
- Modify: All TSX files using `.agentstudio-*` layout classes

- [ ] **Step 1: 识别 layout.css 中所有 CSS class 的使用位置**

```bash
# 找出所有 TSX 文件中使用的 agentstudio- 布局类
grep -rn 'className="agentstudio-\|className={`agentstudio-' frontend/src/components/ --include="*.tsx" | grep -v test | grep -v __tests__ | sort -u | head -50
```

输出应该列出类似: `agentstudio-app`, `agentstudio-body`, `agentstudio-right`, `agentstudio-header-*`, `agentstudio-sidebar`, `agentstudio-main` 等。

- [ ] **Step 2: 逐个替换 CSS class 为 Tailwind**

按照 class 在 DOM 中的层次逐层替换：

| CSS class | Tailwind 替代 |
|-----------|---------------|
| `.agentstudio-app` | `h-screen w-full flex flex-col overflow-hidden bg-[var(--da-bg-primary)] text-[var(--da-text-secondary)]` |
| `.agentstudio-body` | `flex flex-1 overflow-hidden relative` |
| `.agentstudio-right` | `flex flex-col flex-1 overflow-hidden` |
| `.agentstudio-global-header` | `h-14 flex items-center justify-between px-4 flex-shrink-0 z-40 bg-[var(--da-bg-card)]` |
| `.agentstudio-main` | `flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[var(--da-bg-primary)]` |
| `.agentstudio-main-bottom` | `flex-1 flex flex-col overflow-hidden` |
| `.agentstudio-sidebar` | `w-[var(--da-sidebar-width)] min-w-[16rem] max-w-[22rem] h-full bg-[var(--da-bg-sidebar)] flex flex-col z-40 absolute left-0 top-0 -translate-x-full transition-transform duration-200 md:relative md:translate-x-0` |
| `.agentstudio-sidebar.open` | `translate-x-0` |
| `.agentstudio-sidebar.collapsed` | `md:absolute md:-translate-x-full` |

修改方式：在每个 TSX 组件中，找到 `className="agentstudio-xxx"` 替换为对应的 Tailwind 类名。

**重要：只能用一个 task 处理，因为在 TSX 中改动 className 是全局搜索替换。** 顺序是：
1. 先在 layout.css 里找到所有类定义
2. 再在所有 TSX 文件里搜索这些类名
3. 逐个 TSX 文件替换

每条 CSS 规则至少对应 1 个 TSX 文件中的 className。

不要删除 layout.css 中的 CSS 规则（可能还有未覆盖的使用），完成所有 TSX 替换后 layout.css 中的规则自然失效。

- [ ] **Step 3: 验证**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
```

Expected: 编译通过，测试通过

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "refactor(layout): migrate agentstudio layout classes to Tailwind"
```

---

### Task 2: 替换 sidebar 子 CSS 文件

**Files:**
- Modify: `frontend/src/components/AgentStudio/AgentStudioSidebar.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/UserMenu.tsx` (如果存在)
- Modify: `frontend/src/components/AgentStudio/modals/ConversationsList.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/TeamTree.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/TeamTreeAgentItem.tsx`
- Delete: `frontend/src/styles/sidebar/projects.css`
- Delete: `frontend/src/styles/sidebar/usermenu.css`
- Modify: `frontend/src/styles/sidebar/index.css`

- [ ] **Step 1: 删除 usermenu.css 和 projects.css**

删除 `frontend/src/styles/sidebar/usermenu.css` (90行，已被 layout.css 完全替代)
删除 `frontend/src/styles/sidebar/projects.css` (23行，无对应组件)
从 `frontend/src/styles/sidebar/index.css` 移除这两个 import

- [ ] **Step 2: 替换 logo.css 样式**

将 `frontend/src/styles/sidebar/logo.css` 中的样式用 Tailwind 替代到 `AgentStudioSidebar.tsx`。

logo.css 中的类：
- `.agentstudio-logo` → `flex items-center justify-center w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--da-bg-primary),var(--da-text-primary)_8%)] text-[var(--icon-planning)] flex-shrink-0 shadow-sm`
- `.agentstudio-sprint-btn` → `flex items-center justify-center gap-2 w-full py-2 px-3 bg-transparent border-none rounded-lg text-[var(--da-text-primary)] text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-[var(--da-bg-hover)]`

- [ ] **Step 3: 替换 headers.css 样式**

将 headers.css 中的按钮样式用 Tailwind 替代。

- `.agentstudio-icon-btn` → `flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-[var(--da-text-secondary)] cursor-pointer transition-colors hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)]`

- [ ] **Step 4: 替换 teams.css 样式**

这是最大的 sidebar 子文件 (396行)，包含团队树、Agent 列表、下拉菜单。

- `.agentstudio-team-folder-header` → `flex items-center gap-2 w-full p-2 rounded-md cursor-pointer text-sm text-[var(--da-text-secondary)] hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] transition-all`
- `.agentstudio-team-agent-item.active` → `bg-[var(--da-accent-indigo)]/10 text-[var(--da-accent-indigo)]`
- 其他类名相似替换

- [ ] **Step 5: 替换 conversations.css 样式**

- `.agentstudio-conv-item` → `flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-[var(--da-text-secondary)] cursor-pointer hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] transition-all overflow-hidden text-ellipsis whitespace-nowrap`
- `.agentstudio-conv-item.active` → `text-[var(--da-text-primary)] bg-[var(--da-bg-surface)] font-medium`

- [ ] **Step 6: 清理 misc.css**

将返回按钮样式迁移后，删除 `sidebar/misc.css`。

- [ ] **Step 7: 删除 sidebar 子 CSS 文件引用**

修改 `frontend/src/styles/sidebar/index.css` 为：

```css
/* sidebar/index.css — 全部已迁移到 Tailwind className */
/* 保留空文件或删除 */
```

保留空文件避免 import 报错，后续阶段整体清理。

- [ ] **Step 8: 验证 + 提交**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
git add -A
git commit -m "refactor(sidebar): migrate sidebar styles to Tailwind className"
```

---

### Task 3: 迁移 WorkstationPage.tsx 内联样式

**Files:**
- Modify: `frontend/src/components/AgentStudio/WorkstationPage.tsx`
- Create (或者修改现有的): 不需要新建 CSS 文件，全部用 Tailwind

- [ ] **Step 1: 替换导航栏内联样式**

WorkstationPage.tsx 中第 22-62 行的全部内联 `style={{}}` 替换为 Tailwind className：

```tsx
// 改前:
<div style={{ display: 'flex', flex: 1, flexDirection: 'row', minHeight: 0 }}>
  <nav style={{ width: '180px', flexShrink: 0, display: 'flex', flexDirection: 'column',
    overflowY: 'auto', borderRight: '1px solid var(--da-border-subtle)',
    background: 'var(--da-bg-surface)', padding: '20px 12px' }}>

// 改后:
<div className="flex flex-1 flex-row min-h-0">
  <nav className="w-[180px] flex-shrink-0 flex flex-col overflow-y-auto
    border-r border-[var(--da-border-subtle)] bg-[var(--da-bg-surface)] p-5 px-3">
```

替换所有按钮的内联样式：

```tsx
// 改前:
<button
  key={tab.id}
  onClick={() => setActiveTab(tab.id)}
  style={{
    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
    padding: '8px 10px', marginBottom: '2px', borderRadius: '6px',
    border: 'none', cursor: 'pointer', fontSize: '13px', textAlign: 'left',
    background: activeTab === tab.id ? 'var(--da-bg-hover)' : 'transparent',
    color: activeTab === tab.id ? 'var(--da-accent)' : 'var(--da-text-secondary)',
    fontWeight: activeTab === tab.id ? 500 : 400,
    transition: 'background 0.12s ease, color 0.12s ease',
  }}
  onMouseEnter={(e) => { ... }}
  onMouseLeave={(e) => { ... }}>

// 改后:
<button
  key={tab.id}
  onClick={() => setActiveTab(tab.id)}
  className={`flex items-center gap-2.5 w-full px-2.5 py-2 mb-0.5 rounded-md border-none
    cursor-pointer text-sm text-left transition-colors duration-100
    ${activeTab === tab.id
      ? 'bg-[var(--da-bg-hover)] text-[var(--da-accent)] font-medium'
      : 'bg-transparent text-[var(--da-text-secondary)] font-normal hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]'
    }`}>
```

- [ ] **Step 2: 替换 ModuleFallback 内联样式**

```tsx
// 改前:
<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', gap: '12px', padding: '32px', textAlign: 'center' }} role="alert">

// 改后:
<div className="flex flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
```

```tsx
// 改前:
<button style={{ display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '8px 16px', borderRadius: '6px', background: 'var(--da-accent)',
  color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}>

// 改后:
<button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md
  bg-[var(--da-accent)] text-white border-none cursor-pointer text-sm hover:opacity-90">
```

- [ ] **Step 3: 删除文件中内联的 `onMouseEnter`/`onMouseLeave`**

将 hover 状态管理从内联事件处理器改为 CSS `className` 条件渲染（已在 Step 1 的 className 中有 `hover:` 前缀实现）。

- [ ] **Step 4: 验证 + 提交**

```bash
cd frontend && npx tsc --noEmit && npx vitest run
git add -A
git commit -m "refactor(workstation): migrate WorkstationPage inline styles to Tailwind"
```

---

## 验证清单

- [ ] `npx tsc --noEmit` 通过
- [ ] `npx vitest run` 全部通过
- [ ] 应用启动后布局正常，sidebar 展开/折叠正常
- [ ] 暗色模式切换正常
- [ ] WorkstationPage 标签导航正常工作
- [ ] 不存在空 CSS 文件（可以留空但保持 import 链完整）
