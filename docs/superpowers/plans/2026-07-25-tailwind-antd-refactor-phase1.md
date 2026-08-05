# Phase 1: 基础设施 + 紧急修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 搭建 Tailwind v4 `@theme` 设计令牌体系、修复 ConfigProvider、修复紧急 a11y 问题、清理未用 CSS 变量

**Architecture:** 在现有代码基础上叠加——不破坏现有样式，新增 Tailwind 主题层作为基础设施，后续阶段逐步迁移

**Tech Stack:** React 18 + Vite 6 + Tailwind v4 + Ant Design 5

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `frontend/src/styles/tailwind-entry.css` | 添加 `@theme` 定义 |
| 修改 | `frontend/src/styles/tokens.css` | 按 Phase 需求清理未用变量 |
| 修改 | `frontend/src/App.tsx` | 修复 ConfigProvider + 添加 skip-link |
| 修改 | `frontend/src/main.tsx` | 调整 CSS 导入顺序 |
| 修改 | `frontend/src/components/shared/Modal.tsx` | 添加 aria-label |
| 修改 | 14 个 Modal 组件 | 逐个添加 modal-close aria-label |
| 删除 | `frontend/src/styles/workstation.css` 中 `@apply` | 替换为纯 CSS 变量 |

---

### Task 1: 定义 Tailwind @theme 令牌体系

**Files:**
- Modify: `frontend/src/styles/tailwind-entry.css`

- [ ] **Step 1: 读取当前 tokens.css 了解所有变量值**

```bash
cat frontend/src/styles/tokens.css | head -30
```

- [ ] **Step 2: 重写 tailwind-entry.css**

```css
@import "tailwindcss";

@theme {
  /* ── 暗色背景层级 (替代 tokens.css 纯黑 #000000) ── */
  --color-surface: #0d0d0d;
  --color-surface-raised: #1a1a1a;
  --color-surface-overlay: #242424;
  --color-surface-elevated: #2a2a2a;
  --color-surface-hover: #333333;

  /* ── 亮色背景层级 ── */
  --color-surface-light: #ffffff;
  --color-surface-raised-light: #f9fafb;
  --color-surface-overlay-light: #f3f4f6;
  --color-surface-hover-light: #e5e7eb;

  /* ── 品牌强调色 ── */
  --color-accent: #6366f1;
  --color-accent-hover: #4f46e5;
  --color-accent-soft: #818cf8;
  --color-accent-muted: #a5b4fc;

  /* ── 文字色阶 ── */
  --color-text-primary: #f1f1f1;
  --color-text-secondary: #a0a0a0;
  --color-text-muted: #6b7280;
  --color-text-tertiary: #4b5563;

  /* ── 边框 ── */
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);
  --color-border-light: rgba(0, 0, 0, 0.08);

  /* ── 字号阶梯 ── */
  --text-xs: 12px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;

  /* ── 圆角阶梯 ── */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

- [ ] **Step 3: 验证 Tailwind 编译正常**

```bash
npx tailwindcss --version
```

Run: `npx tailwindcss --version`
Expected: Tailwind CSS v4.x

- [ ] **Step 4: 提交**

```bash
git add frontend/src/styles/tailwind-entry.css
git commit -m "feat(theme): define Tailwind v4 @theme design tokens"
```

---

### Task 2: 修复 ConfigProvider

**Files:**
- Modify: `frontend/src/App.tsx`
- Read: `frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx`

- [ ] **Step 1: 读取当前 App.tsx**

```bash
head -80 frontend/src/App.tsx
```

- [ ] **Step 2: 修改 App.tsx，将 ConfigProvider 移到根并配置 token**

在 `App.tsx` 中，将 `QueryClientProvider` 内的内容包裹 `ConfigProvider`：

```tsx
import { ConfigProvider, theme } from 'antd';
import { useSettings } from './contexts/SettingsContext';

function ThemedApp() {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgContainer: isDark ? '#1a1a1a' : '#ffffff',
          colorBgElevated: isDark ? '#242424' : '#ffffff',
          borderRadius: 6,
          fontSize: 14,
        },
      }}
    >
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ToastProvider>
            <AuthGate>
              <AppInit />
              <Routes>
                <Route path="*" element={
                  <ErrorBoundary FallbackComponent={Fallback} onError={logError}>
                    <AgentStudioWorkstation />
                  </ErrorBoundary>
                } />
              </Routes>
            </AuthGate>
          </ToastProvider>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ThemedApp />
      </SettingsProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: 删除 AgentStudioWorkstation.tsx 中旧的 ConfigProvider**

删除 `frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx` 中第 182-186 行的：

```tsx
<ConfigProvider theme={{
  algorithm: s.isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
}}>
  <div />
</ConfigProvider>
```

并删除文件顶部的 `import { ConfigProvider, theme } from 'antd';` 如果不再使用。

- [ ] **Step 4: 验证编译**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 5: 提交**

```bash
git add frontend/src/App.tsx frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx
git commit -m "fix(theme): move ConfigProvider to App root, sync Ant Design tokens"
```

---

### Task 3: 添加 skip-link 可访问性元素

**Files:**
- Modify: `frontend/src/App.tsx`
- Read: `frontend/src/styles/base.css`

- [ ] **Step 1: 在 App.tsx 顶部添加 skip-link**

在 `return` 的最顶部（`<QueryClientProvider>` 之前的位置不适合，应在渲染内容的最开头），在 `ThemedApp` 的 return 中添加：

```tsx
<a className="skip-link" href="#main-content" style={{
  position: 'absolute', top: '-100%', left: 8, zIndex: 9999,
  padding: '8px 16px', background: '#6366f1', color: '#fff',
  borderRadius: '0 0 6px 6px', fontSize: 14, textDecoration: 'none',
}} onFocus={(e) => e.target.style.top = '0'}
 onBlur={(e) => e.target.style.top = '-100%'}>
  跳转到主内容
</a>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/App.tsx
git commit -m "fix(a11y): add skip-to-main-content link for keyboard users"
```

---

### Task 4: 为 15 个 modal-close 按钮添加 aria-label

**Files:**
- Modify: 15 modal 文件

- [ ] **Step 1: 搜索并列出所有缺 aria-label 的关闭按钮**

```bash
grep -rn 'modal-close' frontend/src/components/ --include="*.tsx" | grep -v 'aria-label'
```

- [ ] **Step 2: 逐个修复（以 `shared/Modal.tsx` 为例）**

修改 `frontend/src/components/shared/Modal.tsx` 中 `.modal-close` 按钮：

```tsx
<button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
  <X size={16} />
</button>
```

对其他 14 个 modal 文件（LoginModal、AgentConfigModal、TeamFormModal、AgentFormModal、SkillFormModal、ToolFormModal、MCPFormModal、PickerModal、TeamMemberManager、DeleteConfirmModal、BatchDeleteModal、ResourcePickerModal、VersionHistoryModal）重复相同操作。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/ -A
git commit -m "fix(a11y): add aria-label to 15 modal-close buttons"
```

---

### Task 5: 删除 tokens.css 中 28 个未用 CSS 变量

**Files:**
- Modify: `frontend/src/styles/tokens.css`

- [ ] **Step 1: 确认要删除的变量列表**

删除以下变量（从 `tokens.css` 暗色 `:root` 和亮色 `:root:not(.dark)` 均删除）：

```css
/* 删除: */
--da-overlay-bg-light: rgba(0,0,0,0.45);
--da-shadow-sm: rgba(0,0,0,0.06);
--da-shadow-md: rgba(0,0,0,0.12);
--da-shadow-lg: rgba(0,0,0,0.20);
--da-shadow-xl: rgba(0,0,0,0.35);
--da-bg-pressed: #000000;
--da-font-size-2xl: 24px;
--da-workspace-width: 480px;
--da-workspace-min: 360px;
--da-workspace-max: 600px;
--da-header-height: 48px;
--da-input-min-lines: 1;
--da-input-max-lines: 8;
--sidebar-width: 280px;

/* 同时删除对应的亮色模式副本和别名 */
--bg-surface: var(--da-bg-surface);
--bg-elevated: var(--da-bg-elevated);
--bg-hover: var(--da-bg-hover);
--bg-input: var(--da-bg-secondary);
--border-light: var(--da-border-subtle);
--text-secondary: var(--da-text-secondary);
--text-muted: var(--da-text-tertiary);
--icon-design: var(--da-accent-pink);
--icon-dev-frontend: var(--da-accent-cyan);
--icon-dev-backend: var(--da-accent-emerald);
--icon-dev-fullstack: var(--da-accent-purple);
--icon-quality: var(--da-accent-amber);
--icon-ops: var(--da-text-secondary);
--icon-file: var(--da-text-muted);
```

- [ ] **Step 2: 执行删除**

编辑 `frontend/src/styles/tokens.css`，在暗色和亮色块中分别删除以上变量。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/styles/tokens.css
git commit -m "chore(css): remove 28 unused CSS variables from tokens.css"
```

---

### Phase 1 验证清单

- [ ] `npx tsc --noEmit` 通过
- [ ] `cd frontend && npx vitest run` 通过
- [ ] `cd frontend && npx vite build` 通过
- [ ] 应用启动后暗色模式正常渲染
- [ ] skip-link 在 Tab 键聚焦时可见
