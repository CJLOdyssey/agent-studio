# AgentStudio 前端组件大小规范

> **用途**: 作为前端开发 / AI 生成组件时的统一大小标准参考。所有组件尺寸需严格遵循此规范，确保 UI 一致性。

---

## 1. 基础间距体系 (Spacing Scale)

基于 Tailwind CSS 默认 spacing scale（4px 基准），结合项目实际使用模式：

| Token | Tailwind | PX | 使用场景 |
|-------|----------|----|----------|
| `space-0.5` | `0.125rem` | 2px | 极小间距：标签与文字之间、选中标记 |
| `space-1` | `0.25rem` | 4px | 紧凑布局内间距、Tag/Badge 内边距 |
| `space-1.5` | `0.375rem` | 6px | 表格单元格内间距、紧凑按钮内边距 |
| `space-2` | `0.5rem` | 8px | 组件内部 gap（label-input 间距）、小图标边距 |
| `space-2.5` | `0.625rem` | 10px | 下拉菜单项 padding、表格操作栏间距 |
| `space-3` | `0.75rem` | 12px | 列表项间距、按钮内边距 (sm)、输入框内边距 |
| `space-4` | `1rem` | 16px | 卡片内边距 (p-4)、表单字段间距、弹窗内容 padding |
| `space-5` | `1.25rem` | 20px | 弹窗 header/body 间距 (p-5)、卡片组间距 |
| `space-6` | `1.5rem` | 24px | 页面 section 间距、弹窗 padding (p-6)、大卡片内边距 |
| `space-8` | `2rem` | 32px | 页面主区域间距、弹窗与屏幕边缘间距 |
| `space-10` | `2.5rem` | 40px | 大区块间距、Modal 间空距 |
| `space-12` | `3rem` | 48px | 页面级 section 分隔 |

---

## 2. 尺寸变体系统 (Size Variants)

统一使用 `xs | sm | md | lg | xl` 五级尺寸系统。**所有**可缩放组件必须支持这五级。

| Variant | Tailwind 映射 | 参考高度 | 字体大小 | 适用场景 |
|---------|---------------|----------|----------|----------|
| `xs` | `text-xs` | 20-24px | 11-12px | 紧凑表格、过滤栏、标签行 |
| `sm` | `text-sm` | 28-32px | 13px | 表内操作、侧边栏、元数据显示 |
| `md` | `text-sm / text-base` | 32-36px | 13-14px | **默认尺寸**。主内容区、表单 |
| `lg` | `text-base` | 40px | 14-15px | 主要操作按钮、弹窗标题区 |
| `xl` | `text-lg` | 48px | 16-18px | 页面级 Hero、大弹窗标题、空状态主图 |

> **准则**: 除非有强烈理由，始终使用 `md`。`xs` 和 `sm` 仅用于密集辅助区域。`lg`/`xl` 用于强调层级。

---

## 3. 组件大小矩阵

### 3.1 按钮 (Button)

Ant Design `<Button>` 尺寸规范 + Tailwind 覆盖。

| Variant | 高度 | 水平 Padding | 字体 | 边框半径 | 图标大小 |
|---------|------|-------------|------|----------|----------|
| `xs` | 22px | `px-1.5` | 11px | `rounded` (4px) | 12px |
| `sm` | 28px | `px-2.5` | 12px | `rounded-md` (6px) | 14px |
| `md` | 32px | `px-3` | 13px | `rounded-md` (6px) | 14px |
| `lg` | 40px | `px-4` | 14px | `rounded-lg` (8px) | 16px |
| `xl` | 48px | `px-6` | 16px | `rounded-lg` (8px) | 18px |

**Button Group 间距**: `gap-2` (8px)。拥挤区域可降为 `gap-1.5`。

**Icon-only 按钮**: 宽高相等（正方形），`xs=22px, sm=28px, md=32px, lg=40px, xl=48px`。

### 3.2 输入框 / 表单控件 (Input / Form)

Ant Design `<Input>`, `<Select>`, `<TextArea>`, `<DatePicker>` 等。

| Variant | 高度 | 水平 Padding | 字体 | 边框半径 | 与 Label 间距 |
|---------|------|-------------|------|----------|---------------|
| `sm` | 28px | `px-2` | 13px | `rounded-md` (6px) | `gap-1` |
| `md` | 36px | `px-3` | 14px | `rounded-md` (6px) | `gap-1.5` |
| `lg` | 42px | `px-4` | 15px | `rounded-lg` (8px) | `gap-2` |

**表单布局间距**:
- Label ↔ Input: `gap-1.5` (md)
- Input ↔ Error Text: `gap-1`
- 字段之间: `space-y-5` (横向: `gap-4`)
- Form Section 之间: `space-y-8`

### 3.3 表格 (Table)

Ant Design `<Table>`。

| 属性 | 值 |
|------|-----|
| Header 高度 | 40px (`py-2.5 px-4`) |
| Header 字体 | 12px, font-weight 600, uppercase, letter-spacing 0.03em |
| Row 高度 | 44px (`py-2.5 px-4`) |
| Row 字体 | 13px |
| 选中行高亮 | `bg-da-bg-hover` |
| 表格内边距 | 无（由 container 控制） |
| 空状态 | EmptyState 组件，`py-16` |

### 3.4 弹窗 / 对话框 (Modal)

Ant Design `<Modal>` + 自定义 workstation modal。

| 类型 | 宽度 | 高度 | 适用场景 |
|------|------|------|----------|
| 小型弹窗 | `min(400px, 85vw)` | auto (max 60vh) | 确认删除、重命名、简单输入 |
| 中型弹窗 (默认) | `min(600px, 85vw)` | auto (max 80vh) | 表单弹窗、详情查看 |
| 大型弹窗 | `min(760px, 85vw)` | 70vh | 工作站内 CRUD 表单 (Agent/MCP/Skill 编辑) |
| 巨型弹窗 | `min(960px, 90vw)` | 85vh | 全功能编辑器、配置中心 |

**弹窗内部结构**:
- Header: 14px/16px padding (加上下半透明分隔线)
- Title 字体: 15px, font-weight 600
- Body padding: `p-6`, flex column, overflow hidden
- Footer: `px-6 py-4`, 顶部 border, Button gap `gap-2`
- 圆角: `rounded-lg` (8px)

### 3.5 卡片 (Card)

| Variant | 内边距 | 圆角 | 阴影 | Gap |
|---------|--------|------|------|-----|
| 紧凑 | `p-3` | `rounded-lg` | 无 / 1px border | `gap-2` |
| 默认 | `p-4` | `rounded-lg` | `border border-da-border` | `gap-3` |
| 宽松 | `p-6` | `rounded-xl` | `shadow-sm border` | `gap-4` |

**卡片网格间距**:
- 移动端: `gap-3`
- 平板: `gap-4`
- 桌面: `gap-5`

### 3.6 徽标 / 标签 (Badge / Tag)

| Variant | 高度 | 水平 Padding | 字体 | 圆角 |
|---------|------|-------------|------|------|
| `xs` | 16px | `px-1` | 10px | `rounded` (3px) |
| `sm` | 20px | `px-1.5` | 11px | `rounded-md` (4px) |
| `md` | 24px | `px-2` | 12px | `rounded-md` (4px) |
| `lg` | 28px | `px-2.5` | 13px | `rounded-lg` (6px) |

**Badge 颜色类**: `bg-status-{type}`, `bg-bg-hover` (中性)。

### 3.7 头像 (Avatar / Icon 容器)

| Variant | 尺寸 | 图标大小 | 圆角 |
|---------|------|----------|------|
| `xs` | 20px | 12px | `rounded` (4px) |
| `sm` | 24px | 14px | `rounded-md` (6px) |
| `md` | 32px | 16px | `rounded-md` (6px) |
| `lg` | 40px | 20px | `rounded-lg` (8px) |
| `xl` | 48px | 24px | `rounded-lg` (8px) |

### 3.8 导航 (Navigation)

| 元素 | 尺寸 |
|------|------|
| 侧边栏宽度 | `w-[168px]` |
| 侧边栏 padding | `p-3` |
| Nav Group 标签 | 10px, font-medium, uppercase, tracking-widest |
| Nav Item 高度 | 32px (`py-1.5 px-3`) |
| Nav Item 字体 | 13px |
| Nav 分隔线 | `h-px bg-da-border/40` |
| Tab 标签页 header 高度 | 40px |
| Tab 内边距 | `px-4 py-2` |

### 3.9 选择器 / 下拉 (Select / Dropdown)

| Variant | 高度 | 字体 | 选项内边距 |
|---------|------|------|-----------|
| `sm` | 28px | 12px | `px-2 py-1` |
| `md` | 36px | 13px | `px-3 py-1.5` |
| `lg` | 42px | 14px | `px-4 py-2` |

Dropdown menu 宽度跟随触发元素宽度，最小 `120px`。

### 3.10 骨架屏 / 加载占位 (Skeleton)

| 类型 | 高度 | 圆角 | 宽度参考 |
|------|------|------|----------|
| 行骨架 | `h-4` | `rounded` | 随机 60-90% 宽度 |
| 标题骨架 | `h-5` | `rounded` | 40% 宽度 |
| 头像骨架 | `h-10 w-10` | `rounded-lg` | 正方形 |
| 卡片骨架 | `h-32` | `rounded-lg` | 100% 容器宽度 |

**Skeleton 动画**: Tailwind `animate-pulse`, 每项延迟 `--sk-delay: n * 0.05s`。

### 3.11 空状态 (EmptyState)

| 区域 | 尺寸 |
|------|------|
| 图标容器 | 48-64px (`text-3xl` - `text-4xl`) |
| 标题字体 | 16-18px (`text-lg`), font-weight 600 |
| 描述字体 | 14px (`text-sm`), 颜色 `text-da-text-muted` |
| 按钮上下间距 | `mt-4` |
| 整体垂直内边距 | `py-16` |
| 最大宽度 | `max-w-sm` (384px) |

### 3.12 开关 (ToggleSwitch)

| Variant | 宽度 | 高度 | 圆形按钮尺寸 |
|---------|------|------|-------------|
| `sm` | 28px | 16px | 12px |
| `md` | 36px | 20px | 16px |
| `lg` | 44px | 24px | 20px |

### 3.13 分隔线 / Divider

| 场景 | 厚度 | 颜色 | 与内容间距 |
|------|------|------|-----------|
| 弹窗 Header 下 | `1px` | `var(--da-border)` | 无（紧贴） |
| 列表项间 | `1px` | `var(--da-border-subtle)` | 无 |
| Section 间 | `1px` | `var(--da-border)` | `my-6` |

---

## 4. 响应式断点 (Responsive Breakpoints)

基于 Tailwind 默认断点，结合组件行为：

| 断点 | 宽度 | 布局变化 |
|------|------|----------|
| `sm` | 640px | 表格列折叠（隐藏次要列）、卡片单列 |
| `md` | 768px | 侧边栏收起、表单两列布局 |
| `lg` | 1024px | 工作站三列网格、弹窗宽度上限 760px |
| `xl` | 1280px | 全宽布局、侧边栏展开 |
| `2xl` | 1536px | 超大屏优化，内容区最大宽度 |

**移动端适配规则**:
- `<sm`: Modal 全屏 (`max-width: 100vw, border-radius: 0, height: 100dvh`)
- `<md`: 弹窗宽度 `min(calc(100vw - 32px), 600px)`
- `<lg`: 表格隐藏非关键列，水平滚动
- `<xl`: 导航折叠加汉堡菜单

---

## 5. 使用准则

### 何时用什么尺寸

| 场景 | 推荐尺寸 | 理由 |
|------|---------|------|
| 表内操作按钮 | `sm` | 不抢内容焦点 |
| 主 CTA 按钮 | `md` / `lg` | 视觉突出 |
| 表单输入 | `md` | 平衡可点区域和密度 |
| 弹窗标题 | 15px/600 | 清晰但不压内容 |
| 表格 header | 12px uppercase | 最大化信息密度 |
| 卡片 grid | `gap-4` | 呼吸感适中 |
| Badge/Tag | `sm` | 紧凑信息展示 |

### 不允许的 (Banned)

- 混用 `xs` 按钮和 `xl` 输入框在同一行表单中
- 弹窗宽度超过 `95vw`（移动端除外）
- 表格 Row 高度超过 52px（除非有内联编辑）
- 任意组件使用 `px-0` / `p-0` 取消内边距，除非有明确设计意图
- 在不同页面中对同一组件使用不同尺寸变体（Button 在 A 页用 `md`，在 B 页用 `lg`）

### 一致性检查清单

- [ ] 同一页面中同层级组件使用相同 size variant
- [ ] 弹窗类型匹配推荐宽度区间
- [ ] 响应式断点正确适配（移动端 Modal 全屏、表格列折叠）
- [ ] 间距遵循 4px 基准体系，不出现 3px/7px/11px 等非标值
- [ ] 表单控件统一使用 `md`（除非空间极度受限）

---

## 6. 定制化指引

如果需要覆盖以上默认值，遵循以下优先级：

1. **组件 prop**: `size="sm"` > `className="..."` 内联覆盖
2. **Ant Design 定制**: `workstation.css` 中覆盖 `.workstation-modal.ant-modal .ant-*`
3. **Tailwind theme**: `tokens.css` `@theme {}` 中声明自定义 token
4. **CSS 变量**: `var(--da-*)` 全局变量以 `tokens.css` 为准

---

## 7. 附录：快速参考表

| 组件 | 默认变体 | 高度 | 水平 Padding | 字体 | 圆角 |
|------|---------|------|-------------|------|------|
| Button | `md` | 32px | `px-3` | 13px | 6px |
| Input | `md` | 36px | `px-3` | 14px | 6px |
| Select | `md` | 36px | `px-3` | 13px | 6px |
| Table Header | — | 40px | `px-4` | 12px | — |
| Table Row | — | 44px | `px-4` | 13px | — |
| Badge | `sm` | 20px | `px-1.5` | 11px | 4px |
| Modal (大型) | — | 70vh | `p-6` | 15px (title) | 8px |
| Card | 默认 | auto | `p-4` | 14px | 8px |
| Avatar | `md` | 32px | — | 16px (icon) | 6px |
| Toggle | `md` | 20px | — | — | 10px |
| Nav Item | — | 32px | `px-3` | 13px | — |
| Tag | `sm` | 20px | `px-1.5` | 11px | 4px |
