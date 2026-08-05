# Ant Design + Tailwind 全面标准化方案

> **日期**: 2026-07-27
> **状态**: 设计稿
> **目标**: 全项目所有 UI 元素统一为 Ant Design + Tailwind，消除原生元素和自定义 CSS

---

## 1. 原则

- 能用 Ant Design 的组件 → 用 Ant Design（Button, Table, Modal, Slider, Checkbox 等）
- 能用 Tailwind 的样式 → 用 Tailwind className（布局、间距、排版、颜色引用）
- 只有 Ant + Tailwind 都无法实现时才保留纯 CSS
- 视觉效果零变化（通过 CSS 兼容层保证）

## 2. 必须保留的纯 CSS

| 文件 | 原因 | 不可替代性 |
|---|---|---|
| `tailwind-entry.css` | Tailwind 入口 + 设计 Token + 主题变量 | 基础文件 |
| `reset.css` | CSS reset、box-sizing、`:focus-visible` | 无可替代 |
| `fonts.css` | `@font-face` 字体声明 | 只能 CSS |
| `keyframes.css` | `@keyframes` 动画 | Tailwind 可部分替代但非全部 |
| `scrollbar.css` | `::-webkit-scrollbar` 伪元素 | 只能 CSS |
| `transitions.css` | 主题切换过渡（bg/color/border 0.15s） | 只能 CSS |
| `ant-overrides.css` | Ant Design 组件内部样式覆盖 | 必须保留 |

## 3. 可删除的纯 CSS

| 文件 | 内容 | 替代方案 |
|---|---|---|
| `modals/overlay.css` | `.agentstudio-modal-*` | Ant Design `<Modal>` |
| `modals/buttons.css` | `.agentstudio-modal-btn` | Ant Design `<Button>` |
| `modals/confirm.css` | `.agentstudio-confirm-*` | Ant Design `<Modal>` |
| `modals/agent.css` | `.team-form-avatar` | Tailwind `bg-[var(--color-accent)]` + icon |
| `modals/api.css` | `.api-modal`, `.btn-sm` | Tailwind class |
| `modals/newproject.css` | `.new-project-icon`, `.new-project-subtitle` | Tailwind class |
| `modals/settings.css` | `.settings-section h4` | Tailwind class |
| `modals/responsive.css` | `.api-modal` 响应式 | Tailwind responsive |
| `modals/range-slider.css` | `.settings-font-slider` | Ant Design `<Slider>` |
| `auth/login.css` | `.login-*` | Ant Design Modal + Input |

## 4. CSS 兼容层

在 `ant-overrides.css` 中追加覆盖，保证替换后视觉效果不变：

### Button 兼容

```css
/* default: 次要按钮（取消/关闭） */
.wsta-root .ant-btn-default {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 6px;
  height: 36px;
  font-size: 13.5px;
  font-weight: 500;
}
.wsta-root .ant-btn-default:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 4%, transparent);
}

/* primary: 确认/保存按钮 */
.wsta-root .ant-btn-primary {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-text-on-accent);
  border-radius: 6px;
  height: 36px;
}

/* danger: 删除按钮 */
.wsta-root .ant-btn-dangerous {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--color-text-on-accent);
}
.wsta-root .ant-btn-dangerous:hover {
  background: color-mix(in srgb, var(--color-danger), #000000);
}

/* text: 透明图标按钮 */
.wsta-root .ant-btn-text {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
}
.wsta-root .ant-btn-text:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}

/* text + danger: 危险操作图标按钮 */
.wsta-root .ant-btn-text.ant-btn-dangerous {
  color: var(--color-danger);
}
.wsta-root .ant-btn-text.ant-btn-dangerous:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}

/* link: 文字按钮（忘记密码等） */
.wsta-root .ant-btn-link {
  color: var(--color-accent);
  padding: 0;
  height: auto;
}
```

## 5. Button 替换规则

每个原生 `<button>` 按功能映射：

| 当前样式特征 | 功能 | 映射 |
|---|---|---|
| `bg-transparent border-none` + 图标 | 关闭、更多、编辑 | `<Button type="text" icon={...} />` |
| `bg-[var(--color-surface-raised)]` | 取消、返回 | `<Button>`（默认 type）|
| `bg-[var(--color-accent)]` + `text-on-accent` | 确认、保存、新建 | `<Button type="primary">` |
| `bg-[var(--color-danger)]` | 删除确认 | `<Button danger type="primary">` |
| `text-[var(--color-danger)]` | 文本样删除 | `<Button danger type="text">` |
| `transparent` + `text-[var(--color-accent)]` | 忘记密码、文字链接 | `<Button type="link">` |

## 6. Table 替换方案

8 个 Management 文件改为 Ant Design `<Table>`。

### columns 映射模板

```tsx
const columns: ColumnsType<Item> = [
  // 复选框列（有全选时）
  {
    title: <Checkbox checked={allOnPageSelected} onChange={toggleSelectAll} />,
    dataIndex: 'id',
    key: 'selection',
    width: 40,
    render: (id: string) => <Checkbox checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} />,
  },
  // 数据列
  { title: '列名', dataIndex: 'field', key: 'field' },
  // 状态列（带 Tag）
  {
    title: '状态', dataIndex: 'status', key: 'status',
    render: (status: string) => <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag>,
  },
  // 操作列
  {
    title: '操作', key: 'action', width: 80,
    render: (_: unknown, record: Item) => (
      <Button type="text" icon={<MoreVertical size={15} />} onClick={() => handleMenu(record)} />
    ),
  },
];
```

使用 `pagination={false}` 保留现有 `WstaPagination` 组件。

## 7. 弹窗迁移方案

| 当前实现 | 改为 |
|---|---|
| `DeleteConfirmModal.tsx` — 用 `agentstudio-modal-*` 类 | `<Modal footer={[Cancel, Confirm]} >` |
| `BatchDeleteModal.tsx` — 同上 | 同上 |
| `ConfirmModal.tsx` — 同上 | 同上 |
| `ArchiveConfirmModal.tsx` — 同上 | 同上 |
| `CreateModal.tsx` — 自定义 div | `<Modal>` |
| `VersionHistoryModal.tsx` — 自定义 div | `<Modal>` |
| `SettingsModal.tsx` — 自定义 div | `<Modal>` |
| `NewProjectModal.tsx` — 自定义 div | `<Modal>` |
| `ApiManagementModal.tsx` — 自定义 div | `<Modal>` |
| `LoginModal.tsx` — 自定义 div + `auth/login.css` | `<Modal>`（删除 login.css）|
| `ForgotPasswordForm.tsx` — 自定义 div + `auth/login.css` | 作为 LoginModal 子组件，复用 Modal |

## 8. 执行顺序

```
Phase 0: CSS 兼容层 → ant-overrides.css 追加 Button/Table 覆盖
  ↓ 构建 + 浏览器提取样式验证
Phase 1: Button 替换（53 个文件，分 5 个批次并行）
  ↓ 每批构建 + 浏览器提取样式验证
Phase 2: Table 替换（8 个文件）
  ↓ 构建 + 浏览器验证
Phase 3: 弹窗迁移（11 个文件）
  ↓ 构建 + 浏览器验证
Phase 4: CSS 文件清理（10 个文件）
  ↓ 构建 + 浏览器验证
```

## 9. 验证方式

- 每次改动后 `npm run build`（零 error）
- 浏览器 `getComputedStyle()` 提取 button/table 关键样式对比
- 明暗双主题确认

## 10. 回滚策略

每个 Phase 独立提交。`git revert <commit>` 单 Phase 回滚。
