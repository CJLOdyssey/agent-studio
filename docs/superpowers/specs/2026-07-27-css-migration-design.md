# CSS 样式迁移方案

> **日期**: 2026-07-27
> **状态**: 设计稿
> **目标**: 将所有 CSS 收归 `frontend/src/styles/` 目录，消除内联样式和 `<style>` 标签

---

## 1. 背景

当前项目 CSS 三层混合架构（Ant Design + Tailwind + raw CSS）中，存在 4 类违规：

| 违规类型 | 数量 |
|---|---|
| `styles/` 目录外的 CSS 导入 | 1 处 |
| `<style>` 内联标签 | 4 处 |
| 内联 `style={}` | 211 处（45 个文件） |
| 硬编码色值（不跟随主题） | ~10 处（WorkflowEditor） |

要求迁移后保持视觉效果完全不变，仅改变样式的组织方式。

## 2. 目标架构

```
main.tsx 导入
  ├── styles/tailwind-entry.css      ← Tailwind v4 + 设计 token + 主题变量
  ├── styles/base/index.css           ← reset/fonts/keyframes/scrollbar/transitions
  ├── styles/auth/login.css           ← LoginModal / ForgotPasswordForm 样式
  ├── styles/modals/index.css         ← modal 组件样式
  └── styles/workstation/index.css    ← Ant 覆盖 / 外部库 CSS @import / 共享组件类
```

## 3. 决策矩阵

| 样式类型 | 优先用 | 回退到 raw CSS 条件 |
|---|---|---|
| 布局 (flex/grid/position) | Tailwind className | 动态计算的 top/left（弹出菜单位置） |
| 间距 (margin/padding/gap) | Tailwind className | — |
| 排版 (字号/字重/颜色) | Tailwind className | — |
| 颜色/背景 | Tailwind 任意值 `bg-[var(--)]` | — |
| 宽高 | Tailwind `w-[xxx]` / `max-w-[xxx]` | — |
| Ant 组件全局主题 | `ConfigProvider` theme token | Ant token 覆盖不了的 → `ant-overrides.css` |
| Ant 组件内部样式 | `ant-overrides.css` (raw CSS) | N/A |
| 动画关键帧 | `keyframes.css` (raw CSS) | N/A — Tailwind 无等价物 |
| 滚动条 | `scrollbar.css` (raw CSS) | N/A |
| `@font-face` | `fonts.css` (raw CSS) | N/A |
| CSS 变量定义 | `tailwind-entry.css` | N/A |

## 4. 迁移分组

### Phase 1: 零风险迁移（6 处）

| 序号 | 文件 | 操作 | 目标 |
|---|---|---|---|
| 1.1 | `LoginModal.tsx:463` | 删除 `<style>` | `keyframes.css` 已有 `@keyframes fadeIn` |
| 1.2 | `WorkstationPage.tsx:37` | 移动 5 条表/输入覆盖 | `ant-overrides.css` |
| 1.3 | `WorkstationPage.tsx:124` | 移动 `@keyframes wstaFadeIn/FadeSlideIn` | `keyframes.css` |
| 1.4 | `ApiProviderTab.tsx:203` | 移动 `.api-key-table` 6 条 `!important` | `ant-overrides.css` |
| 1.5 | `WorkflowEditor.tsx:17` | 移动 `import 'reactflow/dist/style.css'` | `workstation/index.css` |
| 1.6 | `App.tsx:38` | 将 `loadingScreenStyle` 对象 → CSS class | `base/index.css` |

**验证**: LSP clean + 构建通过 + 页面加载正常

### Phase 2: 简单 Tailwind 替换（~150 处, ~35 文件）

将 `style={{ maxWidth: 320 }}`、`style={{ flex: 1 }}`、`style={{ display: 'flex', gap: 6 }}` 等直接映射为 Tailwind className。

**规则**:
- `maxWidth: 320` → `className="max-w-[320px]"`
- `flex: 1, minWidth: 0` → `className="flex-1 min-w-0"`
- `display: 'flex', alignItems: 'center', gap: 6` → `className="flex items-center gap-1.5"`
- 所有颜色值通过 `var(--)` 引用 → `className="text-[var(--color-*)]"`
- `fontWeight: 600` → `className="font-semibold"`

**验证**: 逐文件 LSP + 构建通过

### Phase 3: Modal 宽度统一（~8 处, 7 文件）

| 文件 | 当前值 | 改为 |
|---|---|---|
| `AgentFormModal.tsx` | `maxWidth: 640` | `className="max-w-[640px]"` |
| `SkillFormModal.tsx` | `maxWidth: 640` | 同上 |
| `ToolFormModal.tsx` | `maxWidth: 560` | `className="max-w-[560px]"` |
| `PromptFormModal.tsx` | `maxWidth: 560` | 同上 |
| `OutputFormModal.tsx` | `maxWidth: 540` | `className="max-w-[540px]"` |
| `MCPFormModal.tsx` | `maxWidth: 560` | 同上 |
| `DeleteConfirmModal.tsx` | `maxWidth: 420` | `className="max-w-[420px]"` |
| `BatchDeleteModal.tsx` | `maxWidth: 420` | 同上 |

### Phase 4: LoginModal + ForgotPasswordForm 重构（~50 处, 2 文件）

- 将 `inputStyle` / `btnStyle` 等重复内联对象抽取为 CSS class
- 新增 `styles/auth/login.css`，在 `main.tsx` 中与其他 index.css 同级导入

### Phase 5: WorkflowEditor 硬编码色值（1 文件）

| 当前 | 改为 |
|---|---|
| `background: '#fff'` | `background: 'var(--color-surface-card)'` |
| `border: '1px solid #e5e7eb'` | `border: '1px solid var(--color-border)'` |
| `color: '#ef4444'` 等 | `color: 'var(--color-danger)'` |
| `background: '#3b82f6'` | `background: 'var(--color-accent)'` |

### Phase 6: 白名单确认（~5 处）

动态计算值维持 inline，加注释 `// style-skip-migration`：
- `CodeBlock.tsx` — `oneDark` 第三方样式对象
- `TeamMemberManager.tsx` — 循环 `animationDelay`
- `WstaDropdownPortal.tsx` — 动态 `top`/`left`
- `LoadingSkeleton.tsx` — `Math.random()` 随机宽度
- `LoginModal.tsx` — `animation: 'fadeIn'`

## 5. 执行顺序与风险控制

```
Phase 1: 零风险（纯移动） → 15 min
  ↓ LSP + build + 肉眼确认
Phase 2: Tailwind 替换  → 60 min
  ↓ LSP + build + 截屏比对
Phase 3: Modal 宽度      → 10 min
  ↓ LSP + build
Phase 4: LoginModal 重构  → 20 min
  ↓ LSP + build + 明暗主题截屏 diff
Phase 5: WorkflowEditor  → 15 min
  ↓ LSP + build + 明暗主题确认
Phase 6: 白名单注释      → 5 min
```

每个 Phase 完成后全量构建 + 明暗双主题验证。

## 6. 保持不变的部分

- `ConfigProvider` theme token（App.tsx）— Ant Design 强制 CSS-in-JS
- `oneDark` 样式对象（CodeBlock.tsx）— 第三方库限制
- 运行时动态计算值 — CSS 无法表达

## 7. 回滚策略

每个 Phase 独立提交，如有问题 `git revert <commit>` 单 Phase 回滚，不影响其他 Phase。
