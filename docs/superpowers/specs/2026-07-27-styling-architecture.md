# AgentStudio 样式架构规范

> **日期**: 2026-07-27
> **状态**: 设计稿
> **目标**: 定义本项目 Ant Design + Tailwind + 纯 CSS + Inline Style 的分工边界

---

## 1. 决策金字塔

```
  元素是什么？
       │
       ▼
┌──────────────────────────────────────────┐
│ 交互组件 (Button / Input / Select /       │
│ Modal / Table / Dropdown)                │
│ → 用 Ant Design (行为骨架)                │
│ → Ant Design CSS-in-JS 覆盖了视觉属性？    │
│   → Inline style (高度/圆角/字重)          │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 布局 / 间距 / 颜色引用 / 排版              │
│ → Tailwind 标准 Token                    │
│   flex / items-center / gap-3 / p-4      │
│   text-sm / font-medium                  │
│   text-[var(--color-text-primary)]       │
│   bg-[var(--color-surface)]              │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ 方括号任意值 pl-[10px] / ml-[26px]        │
│ → 使用 Inline style                      │
│   (Tailwind v4 logical property 被 reset │
│    覆盖，Ant Design 组件内部也不可穿透)     │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ @keyframes / @font-face /                │
│ ::-webkit-scrollbar / CSS reset           │
│ → 纯 CSS 文件 (styles/ 目录下)             │
└──────────────────────────────────────────┘
```

## 2. 各层详细规则

### 2.1 Ant Design — 管行为

| 组件 | 使用范围 | 视觉覆盖方式 |
|---|---|---|
| `<Button>` | 全部交互按钮 | `style={{ height, borderRadius, fontWeight }}` |
| `<Input>` | 全部文本输入 | `style={{ height }}` (如需) |
| `<Select>` | 全部下拉选择 | `className` 控制宽度 |
| `<Table>` | 管理列表页 | `className` + CSS 兼容层 |
| `<Modal>` | 全部弹窗 | `className="workstation-modal"` |
| `<Pagination>` | 分页 | `className` + CSS 兼容层 |
| `<Dropdown>` | 右键菜单 | Ant Design 默认 |
| `<Checkbox>` | 多选 | Ant Design 默认 |

**关键原则**：Ant Design 组件的**视觉属性**（height、border-radius、padding、font-weight）一定会被其 CSS-in-JS 覆盖。Tailwind className 无法穿透。因此**必须用 inline style**：

```tsx
// ✅ 正确
<Button
  className="w-full flex items-center gap-2"
  style={{ height: 40, borderRadius: 9999, fontWeight: 500 }}
>
  新建对话
</Button>

// ❌ 错误 — height 会被 antd 覆盖
<Button className="w-full h-10 rounded-full font-medium">
  新建对话
</Button>
```

### 2.2 Tailwind — 管布局 + 间距 + 颜色

**安全使用：**

| 类别 | 示例 | 原因 |
|---|---|---|
| 布局 | `flex`, `flex-1`, `items-center`, `justify-between` | 无 Ant Design 干扰 |
| 标准间距 Token | `p-1`, `mt-2`, `gap-3`, `px-4` | 有 baseline 物理 class |
| 颜色引用 | `text-[var(--color-*)]`, `bg-[var(--color-*)]` | CSS 变量只读 |
| 字体 | `text-sm`, `font-medium`, `leading-[1.3]` | 在非 Ant Design 元素上安全 |
| 宽度/高度（非 antd 组件） | `w-full`, `h-9` | 安全 |

**禁止使用：**

```tsx
// ❌ 禁止 — Tailwind v4 方括号间距任意值生成 logical property
// padding-inline-start: 10px 被 reset.css 的 padding: 0 覆盖
<div className="pl-[10px]">...</div>

// ✅ 改为 inline style
<div style={{ paddingLeft: 10 }}>...</div>
```

### 2.3 纯 CSS — 只在 `styles/` 目录

必须保留的文件：

| 文件 | 内容 | 不可替代原因 |
|---|---|---|
| `base/reset.css` | CSS reset, `:focus-visible` | — |
| `base/fonts.css` | `@font-face` | 只能 CSS |
| `base/keyframes.css` | `@keyframes` | — |
| `base/scrollbar.css` | `::-webkit-scrollbar` | 只能 CSS |
| `base/transitions.css` | 主题切换过渡 | — |
| `tailwind-entry.css` | CSS 变量 + Tailwind 入口 | 基础文件 |
| `workstation/ant-overrides.css` | Ant Design 内部覆盖 | — |
| `modals/*.css` | 弹窗 CSS 类 | — |

### 2.4 Inline Style — 仅覆盖 Ant Design CSS-in-JS

```tsx
// 只在以下场景使用 inline style：
// 1. Ant Design 组件上被覆盖的视觉属性
// 2. Tailwind 方括号间距任意值

// ✅ 场景 1
<Button style={{ fontWeight: 500 }}>文字</Button>

// ✅ 场景 2
<div style={{ paddingLeft: 10 }}>内容</div>

// ❌ 不需要 — 普通 Tailwind 能处理
<div className="flex gap-2 p-4">内容</div>
```

## 3. Ant Design CSS-in-JS 优先级说明

Ant Design v5 通过 `@ant-design/cssinjs` 在运行时注入 `<style>` 标签，生成 hash className（如 `.css-abc123`）：

```
选择器                           优先级
.ant-btn.css-abc123.ant-btn-default   0,3,0
.wsta-root .ant-btn-default           0,2,0  ← 静态 CSS 输
div > span                            0,0,2
```

因此：
- **Tailwind class**（0,1,0 左右）→ 被 antd 覆盖 ❌
- **纯 CSS**（0,2,0）→ 被 antd 覆盖 ❌
- **Inline style**（1,0,0）→ **唯一能赢** ✅

这是 Ant Design 架构的选择，无法绕过。

## 4. 迁移后的 CSS 文件清单

```
frontend/src/styles/
├── tailwind-entry.css        ← Tailwind v4 + 设计 Token + 主题变量
├── base/
│   ├── index.css              ← 聚合入口
│   ├── reset.css              ← CSS reset / :focus-visible
│   ├── fonts.css              ← JetBrains Mono @font-face
│   ├── keyframes.css          ← @keyframes 动画
│   ├── scrollbar.css          ← ::-webkit-scrollbar
│   └── transitions.css        ← 主题切换过渡
├── modals/
│   ├── index.css              ← 聚合入口
│   ├── overlay.css            ← .agentstudio-modal-*
│   ├── buttons.css            ← .agentstudio-modal-btn
│   ├── confirm.css            ← .agentstudio-confirm-*
│   ├── agent.css              ← .team-form-avatar
│   ├── api.css                ← .api-modal / .btn-sm
│   ├── newproject.css         ← .new-project-*
│   ├── settings.css           ← .settings-section
│   ├── responsive.css         ← .api-modal 响应式
│   └── range-slider.css       ← .settings-font-slider
└── workstation/
    ├── index.css              ← 聚合入口
    └── ant-overrides.css      ← Ant Design 组件覆盖
```

## 5. 未来开发规范

### 新建组件时

```tsx
// 1. 交互组件 → Ant Design
<Button
  className="flex items-center gap-2"
  style={{ height: 36, fontWeight: 500 }}
  onClick={handleClick}
>
  操作
</Button>

// 2. 布局 → Tailwind
<div className="flex items-center justify-between p-4 gap-3">
  <span className="text-sm text-[var(--color-text-primary)]">标题</span>
</div>

// 3. 间距任意值 → inline style
<div style={{ paddingLeft: 10 }}>缩进内容</div>

// 4. Ant Design 组件内部被覆盖的宽度
<Select
  className="w-[120px]"  // 会被 antd 覆盖
  // style={{ width: 120 }}  // 如果需要精确控制
/>
```

### 禁止事项

1. ❌ 不要在 Ant Design 组件上用 Tailwind 控制 `height`、`border-radius`、`font-weight`、`padding`
2. ❌ 不要用 `pl-[10px]`、`ml-[26px]` 等方括号间距任意值
3. ❌ 不要用 `!important` 对抗 Ant Design CSS-in-JS
4. ❌ 不要自己写 CSS 替代 Ant Design 已有组件
5. ✅ 优先用 Ant Design，其次 Tailwind，其次 inline style，最后纯 CSS
