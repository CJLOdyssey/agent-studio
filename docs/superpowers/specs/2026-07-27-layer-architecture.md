# Ant Design + Tailwind @layer 架构方案

> **日期**: 2026-07-27
> **状态**: 设计稿
> **目标**: 通过 CSS `@layer` 让 Tailwind utilities 天然覆盖 Ant Design CSS-in-JS，消除 inline style 和 `!important`

---

## 1. 背景

当前项目 Ant Design v5.29.3 + Tailwind v4，存在 CSS 优先级问题：

| 问题 | 现象 | 原因 |
|---|---|---|
| `h-10` 不生效 | Button 高度永远是 32px | Ant Design CSS-in-JS 优先级高于 Tailwind |
| `rounded-full` 不生效 | Button 圆角永远是 6px | 同上 |
| `font-medium` 不生效 | Button 字重永远是 400 | 同上 |
| 被迫 inline style | `style={{ height: 40, borderRadius: 9999 }}` | 唯一能赢的方式 |

行业标准做法：Ant Design 官方提供的 `StyleProvider layer` + CSS `@layer` 排序。

## 2. 原理

CSS `@layer` 层叠规则：

```
优先级: unlayered > 后声明的 layer > 先声明的 layer
```

配置后：

```
layer 顺序: theme < base < antd < components < utilities
                                              ↑ 最高
```

- Ant Design CSS-in-JS → `antd` layer（通过 `StyleProvider layer`）
- Tailwind utilities → `utilities` layer（最高层）
- reset.css → `base` layer
- Tailwind 的 `h-10` 在 `utilities` 层 > Ant Design 在 `antd` 层 → ✅ 天然赢

## 3. 改动清单

### 3.1 安装依赖

```bash
npm install @ant-design/cssinjs
```

### 3.2 App.tsx — 包裹 StyleProvider

```tsx
import { StyleProvider } from '@ant-design/cssinjs';

return (
  <StyleProvider layer>
    <ConfigProvider theme={...}>
      {/* 所有现有内容 */}
    </ConfigProvider>
  </StyleProvider>
);
```

### 3.3 tailwind-entry.css — 声明 layer 顺序

```css
@layer theme, base, antd, components, utilities;

@import "tailwindcss";
@import "./base/index.css" layer(base);
```

### 3.4 main.tsx — 调整 CSS 加载顺序

```tsx
import './styles/tailwind-entry.css';     // 先加载 Tailwind + @layer
import './styles/workstation/index.css';  // 后加载工作站覆盖
import './styles/modals/index.css';       // 后加载弹窗
```

### 3.5 删除不再需要的兼容代码

- `tailwind-entry.css`：删除全部 spacing fallback class（`.px-*`、`.py-*`、`.p-*`、`.m-*` 等约 120 行）
- `ant-overrides.css`：删除 `.ant-btn-default`、`.ant-btn-primary`、`.ant-btn-text`、`.ant-btn-dangerous`、`.ant-btn-link` 兼容层
- `ant-overrides.css`：删除 `.ant-table` 兼容层
- `UserMenu.tsx`：PopoverItem 和 用户按钮换回 `<Button>`
- `AgentStudioSidebar.tsx`：inline style 换回 `className="h-10 rounded-full"`
- `TeamTreeAgentItem.tsx`：按钮 `px-0` 等换回正常 Tailwind

## 4. 预期效果

| 写法 | 配 @layer 前 | 配 @layer 后 |
|---|---|---|
| `<Button className="h-10">` | 32px（被 antd 覆盖） | **40px** ✅ |
| `<Button className="rounded-full">` | 6px（被 antd 覆盖） | **9999px** ✅ |
| `<Button className="font-medium">` | 400（被 antd 覆盖） | **500** ✅ |
| `<div className="pl-[10px]">` | 0px（logical property 被 reset 覆盖） | **10px** ✅（reset 在 base 层，Tailwind 在 utilities 层） |

**所有 inline style 可以改回 Tailwind className**。

## 5. 验证方式

1. `npm run build` 零 error
2. 浏览器检查 Button 高度是否为 40px、圆角是否为 9999px
3. 浏览器检查 spacing 任意值 `pl-[10px]` 是否生效
4. 明暗双主题确认

## 6. 回滚

单 commit，`git revert` 直接回滚。
