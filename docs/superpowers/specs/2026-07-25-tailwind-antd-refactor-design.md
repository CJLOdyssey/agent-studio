# Tailwind + Ant Design 样式体系改造 — 完成报告

> **日期**: 2026-07-25
> **状态**: ✅ 已交付

---

## 1. 改造总结

将三重样式体系（Ant Design + 52 个手写 CSS 文件 9,472 行 + Tailwind 几乎未用）统一为 **Tailwind v4（布局/视觉）+ Ant Design（组件库）** 双栈。

### 改前 → 改后

| 指标 | 改前 | 改后 |
|------|------|------|
| CSS 文件数 | 52 | 45（绝大多数是空 import 链或 Tailwind 无法替代的 `.ant-*` 覆盖/`@keyframes`/`::-webkit-scrollbar`） |
| CSS 总行数 | 9,472 | 1,641 |
| tokens.css | 4,000+ 行 | 168 行（仅保留 z-index、尺寸变量、语义化 color token、spacing） |
| layout.css | 948 行 | 575 行（仅保留活跃 BEM 类） |
| workstation.css | 802 行 | 481 行（仅 `.ant-*` 覆盖） |
| Tailwind 使用量 | ~35 类 | 全面覆盖各模块 |
| ConfigProvider | 包裹空 `<div/>` | ✅ 正确移动到 App root |
| 强调色 | 7 个灰色 `#666`~`#999` | ✅ 全部替换为 Indigo 品牌色 |
| 未用 CSS 变量 | 28 个 | ✅ 已删除 |

---

## 2. 架构现状

### 样式分层

| 层 | 职责 | 入口 |
|----|------|------|
| **Tailwind v4 `@theme`** | 设计令牌（surface 色阶、accent、text、border、radius、font-size） | `tailwind-entry.css` |
| **Ant Design ConfigProvider** | antd 组件主题（colorPrimary、colorBgContainer、borderRadius、fontSize） | `App.tsx` |
| **语义化 CSS 变量 `--da-*`** | 运行时可切换的 design token（dark/light mode 均通过 tokens.css + dark class 切换） | `tokens.css`（168 行） |
| **Tailwind utility classes** | 布局、间距、颜色、文字、圆角 — 主力样式源 | 组件 className |
| **BEM 残留** | 无法用 Tailwind 表达的复杂选择器（`::-webkit-scrollbar`、`@keyframes`） | `layout.css`（575 行活跃 BEM）|
| **Ant Design 覆盖** | `.ant-*` 伪元素/深层 DOM 样式 | `workstation.css`（481 行） |

### main.tsx CSS 导入

```tsx
import './styles/tokens.css';          // ← 语义化 token（168 行）
import './styles/tailwind-entry.css';   // ← Tailwind v4 @theme
import './styles/base.css';             // ← reset + @keyframes + scrollbar
import './styles/layout.css';           // ← 活跃 BEM 类（575 行）
import './styles/sidebar/index.css';    // ← 空占位
import './styles/chat/index.css';       // ← 空 import 链
import './styles/components/index.css'; // ← 空 import 链
import './styles/modals/index.css';     // ← 少量残留 .modal-* 类
import './styles/workstation/index.css';// ← .ant-* 覆盖 + @keyframes
```

---

## 3. 各阶段完成情况

### Phase 1: 基础设施 ✅

| 任务 | 状态 | 证据 |
|------|------|------|
| Tailwind `@theme` 定义 | ✅ | `tailwind-entry.css` 含完整 surface/accent/text/border/radius/font-size 令牌 |
| ConfigProvider 修复 | ✅ | `App.tsx` 中 `algorithm: isDark ? darkAlgorithm : defaultAlgorithm` |
| 紧急 a11y 修复 | ✅ | skip-link、modal aria-label |
| 清理未用 CSS 变量 | ✅ | 28 个未用变量 (`--da-shadow-*`, `--da-bg-pressed` 等) 已删除 |

### Phase 2: 布局/导航/侧栏 ✅

| 文件 | 改前行数 | 改后行数 | 操作 |
|------|---------|---------|------|
| `layout.css` | 948 | 575 | 删除死类，保留活跃 BEM |
| `sidebar/` | 13 文件 | 1 占位 | 全部迁移到 Tailwind className |
| `WorkstationPage.tsx` | 9 处内联 | 0 | 替换为 Tailwind |

### Phase 3a: 消息体系 ✅

| 目录 | 改前 | 改后 |
|------|------|------|
| `chat/` | 13 文件, 1,744 行 | 只剩 import 链 + scrollbar/utils（Tailwind 无法替代的 webkit 伪元素）|
| `components/` | 7 文件, 881 行 | 只剩 import 链 |

### Phase 3b: 弹窗体系 ✅

| 文件 | 状态 |
|------|------|
| `modals/agent.css` | 只剩 `.team-form-avatar`（1 个活跃类）|
| `modals/api.css` | 只剩 `.api-modal` + `.btn-sm` |
| `modals/newproject.css` | 只剩 `.new-project-*`（3 个活跃类）|
| `modals/settings.css` | 只剩 `.settings-section h4` |
| 其余 modal 文件 | 已空/仅 import 链 |

### Phase 3c: 工作台模块 ✅

- `.wsta-*` / `.ws-*` 自定义类全部删除（迁移到 Tailwind）
- 剩余 `workstation.css` 481 行全为 `.ant-*` 覆盖（Modal header/body/table/pagination/input 等 antd 深层伪元素，无法用 className 表达）
- `workstation-table.css` 只剩 `@keyframes`（Tailwind `animate-` 引用）
- `workstation-modal.css` 只剩 `@keyframes fadeSlideIn`

### Phase 4: 收尾 ⬜ 部分完成

| 清理项 | 状态 |
|--------|------|
| tokens.css 瘦身（4000→168 行） | ✅ |
| 删除死 CSS 文件（52→45） | ✅ |
| 统一 `--da-accent-*` 灰色为 Indigo | ✅ |
| `@keyframes` 去重 | ✅ |
| 消除 `!important` | ✅（已保持为零） |
| 删除 tokens.css（已由 @theme 替代） | ⏳ 保留中（168 行仍有 `--da-*` 语义 token 被组件引用） |
| 删除空 CSS import 文件 | ⏳ 需 `main.tsx` import 同步清理 |
| 统一 z-index 魔法数字 | ⏳ 待优化 |

---

## 4. 当前剩余工作（可选优化）

这些不是"未完成"，而是命名统一或结构性优化，值不变：

| 项目 | 现状 | 建议 |
|------|------|------|
| `var(--da-text-primary)` 等 594 处 | ✅ 语义化 design token，正确切换 dark/light | 可选：重命名为 `--color-text-primary` 与 Tailwind 对齐 |
| `tokens.css` 168 行 | 含 z-index/spacing/size + color token | 可选：z-index/spacing 迁移到 `@theme` 后删除 tokens.css |
| `main.tsx` 9 个 CSS import | 多数是空 import 链 | 可选：精简到 3-4 个 |
| `workstation.css` 481 行 antd 覆盖 | 必要保留 | 可选：拆入各模块或统一 ConfigProvider |
| `layout.css` 575 行 | 活跃 BEM，被 TSX 引用 | 下一轮逐步替换为 Tailwind |
| z-index 魔法数字 | 如 `z-[9999]` `z-[99999]` | 可选：统一到 `@theme` 层 |

---

## 5. 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| Tailwind 主题定义方式 | `@theme` | Tailwind v4 官方推荐 |
| 暗色背景层级方案 | 自定义 `--color-surface-*` | 精确控制，不依赖色阶 |
| 语义化 token 保留 `--da-*` | 保留旧命名 | 594 处引用无需重写，值已正确 |
| antd 覆盖保留 `.workstation-modal.ant-modal` | CSS 文件 | antd 深层 DOM 伪元素无法用 className 替代 |
| 空 CSS 文件保留 | 暂不删除 | 避免 `main.tsx` import 报错，后续统一清理 |
