# Phase 3a: 消息体系 + 组件样式 Tailwind 替换 实施计划

**Goal:** 将 chat/*.css (12文件, 1,744行) + components/*.css (7文件, 881行) 替换为 Tailwind className

**Architecture:** 每个子 CSS 文件独立替换为 Tailwind，保留 className 名称作为语义标识，移除 CSS 文件定义

---

### Task 1: 迁移 buttons.css + forms.css + 基础组件

**Files:**
- Modify: `frontend/src/styles/components/buttons.css` — 删除样式定义
- Modify: `frontend/src/styles/components/forms.css`
- Modify: `frontend/src/styles/components/toggle.css`
- Modify: `frontend/src/styles/components/range.css`
- Modify: `frontend/src/styles/components/workspace.css`
- Modify: `frontend/src/styles/components/toast.css`
- Modify: `frontend/src/styles/components/misc.css`
- Modify: 所有 TSX 中使用 `.btn`, `.btn-primary`, `.btn-sm`, `.form-input` 等类的文件

Search for CSS class usage:
```bash
grep -rn 'className="btn\|className="form-\|className="toggle\|className="range' frontend/src/components/ --include="*.tsx" | grep -v __tests__ | sort -u
```

Key replacements:
| CSS Class | Tailwind Replacement |
|-----------|---------------------|
| `.btn` | `inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150` |
| `.btn-primary` | `bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed` |
| `.btn-sm` | `px-2 py-1 text-xs` |
| `.btn-danger` | `bg-[color-mix(in_srgb,var(--icon-status-error)_15%,transparent)] text-[var(--icon-status-error)] hover:bg-[color-mix(in_srgb,var(--icon-status-error)_25%,transparent)]` |
| `.btn-ghost` | `bg-transparent text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-accent-indigo)]` |

After all TSX replacements, clear the CSS file content but keep the file (to avoid import chain breakage).

Verify: `cd frontend && npx tsc --noEmit && npx vitest run`

Commit: `refactor(components): migrate button/form/toggle styles to Tailwind`

---

### Task 2: 迁移 chat/home.css + chat/messages.css + chat/input.css

These are the 3 largest chat CSS files.

Search for usage first:
```bash
grep -rn 'agentstudio-home-\|agentstudio-message-\|agentstudio-input-\|agentstudio-send-btn\|agentstudio-feature-btn' frontend/src/components/ --include="*.tsx" | grep -v __tests__ | sort -u
```

**home.css:** HomeScreen layout, greeting, feature buttons
**messages.css:** Message bubbles, code blocks, thinking tree, copy buttons, version navigation  
**input.css:** Textarea, send button, command popover, attachment area

Procedure per file:
1. Read the CSS class definitions
2. Read the TSX files that use them
3. Replace className with Tailwind equivalents
4. Clear the CSS file content

For `.agentstudio-home-greeting`, check `GreetingAnimation.tsx`:
```tsx
// Before:
<h1 className="agentstudio-home-greeting">
// After:
<h1 className="text-[clamp(24px,4vw,32px)] font-bold tracking-tight text-[var(--da-text-primary)]">
```

For `.agentstudio-send-btn` states, check InputToolbar:
```tsx
// Before:
<button className={`agentstudio-send-btn ${isRunning ? 'running' : hasText ? 'active' : ''}`}>
// After:
<button className={`flex items-center justify-center w-9 h-9 rounded-full border-none cursor-pointer transition-all duration-200 flex-shrink-0
  ${isRunning ? 'bg-[var(--da-accent)] text-white animate-spin' : hasText ? 'bg-[var(--da-accent)] text-white hover:opacity-90' : 'bg-[var(--da-bg-surface)] text-[var(--da-text-muted)] cursor-not-allowed'}`}>
```

For `.agentstudio-home-features` buttons:
```tsx
// Before:
<button className="agentstudio-feature-btn" onClick={...}>
// After:
<button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-[var(--da-text-secondary)] bg-transparent border border-[var(--da-border)] cursor-pointer transition-colors hover:border-[var(--da-text-muted)] hover:text-[var(--da-text-primary)]" onClick={...}>
```

For message bubbles in TeamMessage.tsx/MessagesPanel.tsx, search for `agentstudio-message-`:
```tsx
// Before:
<div className="agentstudio-message-bubble user">
// After:
<div className="max-w-[75%] px-4 py-3 rounded-[12px_12px_4px_12px] bg-[var(--da-msg-user-bg)] border border-[var(--da-border-subtle)] self-end">
```

Verify: `cd frontend && npx tsc --noEmit`
Commit: `refactor(chat): migrate home/messages/input styles to Tailwind`

---

### Task 3: Fix TeamMessage.tsx inline styles (4 spots)

**Files:**
- Modify: `frontend/src/components/AgentStudio/TeamMessage.tsx`

Replace 4 inline styles:
1. Line 137: `style={{ marginLeft: 0 }}` → Tailwind `ml-0`
2. Line 255: `style={{ cursor: 'default' }}` → Tailwind `cursor-default`
3. Line 346: `style={{ transform: 'rotate(180deg)' }}` → Tailwind `rotate-180`
4. Line 388: `style={{ marginLeft: 0 }}` → Tailwind `ml-0`

Verify: `cd frontend && npx tsc --noEmit`
Commit: `fix: replace TeamMessage.tsx 4 inline styles with Tailwind`

---

### Task 4: Migrate remaining chat CSS files

Remaining chat/*.css files:
- `chat/process.css` — 处理流程树
- `chat/artifacts.css` — 产物展示
- `chat/cards.css` — Agent 卡片
- `chat/pagination.css` — 分页
- `chat/welcome.css` — 欢迎面板
- `chat/samples.css` — 示例提示词
- `chat/models.css` — 模型选择器
- `chat/scrollbar.css` — 滚动条
- `chat/utils.css` — 工具类

Each follows the same procedure: find TSX usage → replace className → clear CSS file.

For agent cards (`chat/cards.css`):
```tsx
// Before:
<div className="agentstudio-agent-card">
// After:
<div className="bg-[var(--da-bg-surface)] rounded-lg border border-[var(--da-border)] p-4 cursor-pointer transition-colors hover:bg-[var(--da-bg-hover)]">
```

Verify + commit: `cd frontend && npx tsc --noEmit && npx vitest run`
Commit: `refactor(chat): migrate remaining chat CSS to Tailwind`
