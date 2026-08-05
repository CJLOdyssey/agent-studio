# Ant Design + Tailwind 全面标准化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全项目 UI 元素统一为 Ant Design + Tailwind，消除原生 `<button>`、`<table>`、自定义弹窗和不再需要的纯 CSS 文件。

**Architecture:** CSS 兼容层先行（ant-overrides.css 追加 Button/Table 覆盖），保证替换后视觉零差异。然后按 Button → Table → Modal → CSS 清理顺序执行。

**Tech Stack:** React 18 + Ant Design v5 + Tailwind v4

**All subagents use category: `unspecified-high` (Opus 4.7)**

---

## 文件改动总览

| Phase | 改动量 | 关键成果 |
|---|---|---|
| Phase 0 | 1 CSS 文件 | ant-overrides.css 追加 Button/Table 兼容层 |
| Phase 1 | ~53 文件 | 全部原生 `<button>` → Ant Design `<Button>` |
| Phase 2 | 8 文件 | 管理列表原生 `<table>` → Ant Design `<Table>` |
| Phase 3 | ~11 文件 | 自定义弹窗 → Ant Design `<Modal>` |
| Phase 4 | ~10 CSS 文件 | 删除不再使用的纯 CSS |

---

### Phase 0: CSS 兼容层

#### Task 0.1: 追加 Button / Table 兼容样式

**Files:**
- Modify: `frontend/src/styles/workstation/ant-overrides.css`

在 `ant-overrides.css` **末尾**追加：

```css
/* ════════════════════════════════════════════
   Button Compatibility Layer
   Makes Ant Design Button visually match native
   <button> + Tailwind styles across the app
   ════════════════════════════════════════════ */

/* ── default (次要按钮: 取消/关闭/返回) ── */
.wsta-root .ant-btn-default {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 6px;
  height: 36px;
  font-size: 13.5px;
  font-weight: 500;
  box-shadow: none;
}
.wsta-root .ant-btn-default:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 4%, transparent);
}
.wsta-root .ant-btn-default:active {
  transform: scale(0.97);
}
.wsta-root .ant-btn-default:disabled {
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  border-color: var(--color-border);
  opacity: 1;
}

/* ── primary (确认/保存/新建) ── */
.wsta-root .ant-btn-primary {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-text-on-accent);
  border-radius: 6px;
  height: 36px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: none;
}
.wsta-root .ant-btn-primary:hover {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}
.wsta-root .ant-btn-primary:disabled {
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  border-color: var(--color-border);
}

/* ── primary + danger (删除确认) ── */
.wsta-root .ant-btn-primary.ant-btn-dangerous {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--color-text-on-accent);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-danger) 15%, transparent);
}
.wsta-root .ant-btn-primary.ant-btn-dangerous:hover {
  background: color-mix(in srgb, var(--color-danger), #000000);
  border-color: color-mix(in srgb, var(--color-danger), #000000);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-danger) 25%, transparent);
}

/* ── text (透明图标按钮: 关闭/更多/编辑等) ── */
.wsta-root .ant-btn-text {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  height: auto;
  line-height: 1;
  border-radius: 6px;
}
.wsta-root .ant-btn-text:hover {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}
.wsta-root .ant-btn-text:active {
  background: var(--color-surface-pressed);
}

/* ── text + danger (危险图标按钮: 删除) ── */
.wsta-root .ant-btn-text.ant-btn-dangerous {
  color: var(--color-danger);
}
.wsta-root .ant-btn-text.ant-btn-dangerous:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}

/* ── link (文字按钮: 忘记密码/注册) ── */
.wsta-root .ant-btn-link {
  color: var(--color-accent);
  padding: 0;
  height: auto;
  line-height: inherit;
}
.wsta-root .ant-btn-link:hover {
  color: var(--color-accent-hover);
}

/* ════════════════════════════════════════════
   Table Compatibility Layer
   Builds on existing .ant-table overrides at lines 74-165
   ════════════════════════════════════════════ */

.wsta-root .ant-table-wrapper .ant-table {
  font-size: 13px;
  border-radius: 10px;
}
.wsta-root .ant-table-wrapper .ant-table-thead > tr > th {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

- [ ] **构建验证**

```bash
cd frontend && npm run build
```
Expected: 0 errors

- [ ] **提交**
```bash
git add frontend/src/styles/workstation/ant-overrides.css
git commit -m "feat: add Button/Table CSS compatibility layer for Ant Design migration"
```

---

### Phase 1: Button 替换（53 个文件，5 批次）

所有替换遵循统一规则：

```
原生 <button>                            Ant Design <Button>
────────────────────────────────────────────────────────────────
<button className="bg-transparent        <Button type="text"
  border-none p-1 rounded...">             icon={...} />
                                          
<button className="bg-[var(--color-      <Button>
  surface-raised)] ..." >                  ← type="default"(默认)
                                          
<button className="bg-[var(--color-      <Button type="primary">
  accent)] text-[var(--color-text-on-
  accent)] ..." >
                                          
<button className="bg-[var(--color-      <Button type="primary" danger>
  danger)] ..." >
                                          
<button className="bg-transparent         <Button type="link">
  text-[var(--color-accent)] ..." >
                                          
<button className="text-[var(--color-     <Button type="text" danger>
  danger)] bg-transparent ...">

<button className="inline-flex            <Button>
  items-center gap-2 px-3 py-2            (Tailwind classes移到
  rounded-md ...">                        className上)
```

**重要：** 替换时去掉 `<button>` 上的所有 Tailwind className（background、border、padding、font-size、color 等），这些由 CSS 兼容层保证一致。但 `flex`、`gap`、`margin`、`display` 等布局类需要保留在 `className` 上。

#### Batch A: 共享弹窗操作按钮

- `frontend/src/components/AgentStudio/workstation/shared/DeleteConfirmModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/shared/BatchDeleteModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/shared/CreateModal.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/shared/VersionHistoryModal.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/workstation/shared/ErrorBoundary.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/shared/WstaPagination.tsx` — 0（无原生 button）

**示例：DeleteConfirmModal.tsx**
```tsx
// 改前
<button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
<button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('workstation.cancel')}</button>
<button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_25%,transparent)]" onClick={onConfirm}>{t('workstation.confirmDelete')}</button>

// 改后
<Button type="text" icon={<X size={18} />} onClick={onClose} aria-label={t('common.close')} />
<Button onClick={onClose}>{t('workstation.cancel')}</Button>
<Button type="primary" danger onClick={onConfirm}>{t('workstation.confirmDelete')}</Button>
```

#### Batch B: 表单弹窗操作按钮

- `frontend/src/components/AgentStudio/workstation/agent/AgentFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/team/TeamFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/prompt/PromptFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/output/OutputFormModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/modals/AgentConfigModal.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/modals/ProviderEditModal.tsx` — 4 个 button
- `frontend/src/components/AgentStudio/modals/ApiManagementModal.tsx` — 含 Button（检查）
- `frontend/src/components/AgentStudio/modals/ApiProviderTab.tsx` — 已有 Button（保留）

#### Batch C: 管理页 + 工具栏按钮

- `frontend/src/components/AgentStudio/workstation/agent/AgentManagement.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/workstation/agent/ResourcePickerSection.tsx` — 含 button
- `frontend/src/components/AgentStudio/workstation/team/TeamManagement.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/workstation/team/TeamMemberManager.tsx` — 含 button
- `frontend/src/components/AgentStudio/workstation/tool/ToolManagement.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/prompt/PromptManagement.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/mcp/MCPManagement.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/skill/SkillManagement.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/output/OutputConstraintManagement.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/workstation/logs/LogAudit.tsx` — 1 个 button

#### Batch D: 侧边栏 + 工作台

- `frontend/src/components/AgentStudio/sidebar/TeamTree.tsx` — ~8 个 button
- `frontend/src/components/AgentStudio/sidebar/TeamTreeAgentItem.tsx` — ~3 个 button
- `frontend/src/components/AgentStudio/sidebar/ConversationsList.tsx` — 含 button
- `frontend/src/components/AgentStudio/sidebar/UserMenu.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/WorkstationPage.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/AgentStudioWorkstation.tsx` — 4 个 button
- `frontend/src/components/AgentStudio/AgentStudioSidebar.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/MessagesPanel.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/HomeScreen.tsx` — 含 button
- `frontend/src/components/AgentStudio/workspace/Workspace.tsx` — 含 button

#### Batch E: 登录/其他

- `frontend/src/components/auth/LoginModal.tsx` — 1 个 button（关闭）
- `frontend/src/components/auth/ForgotPasswordForm.tsx` — 5 个 button
- `frontend/src/components/AgentStudio/modals/ConfigItemList.tsx` — 6 个 button
- `frontend/src/components/AgentStudio/modals/ConfirmModal.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/NewProjectModal.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/SettingsModal.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/ModelSection.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/CredentialsSection.tsx` — 含 button
- `frontend/src/components/AgentStudio/modals/ModelSelector.tsx` — 含 button
- `frontend/src/components/AgentStudio/workstation/workflow/WorkflowEditor.tsx` — 3 个 button
- `frontend/src/components/AgentStudio/workstation/workflow/WorkflowManagement.tsx` — 含 button
- `frontend/src/components/AgentStudio/modals/tabs/OutputConstraintTab.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/modals/tabs/SystemPromptTab.tsx` — 1 个 button
- `frontend/src/components/AgentStudio/modals/tabs/SkillsTab.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/tabs/ToolsTab.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/tabs/MCPTab.tsx` — 2 个 button
- `frontend/src/components/AgentStudio/modals/ConnectionTest.tsx` — 含 button
- `frontend/src/components/AgentStudio/workstation/monitor/MonitorHealth.tsx` — 含 button
- `frontend/src/components/AgentStudio/workstation/monitor/MonitorCenter.tsx` — 含 button
- `frontend/src/components/Header.tsx` — 含 button
- `frontend/src/App.tsx` — 1 个 button
- `frontend/src/components/shared/Modal.tsx` — 1 个 button

**验证方式（每批）：**
```bash
cd frontend && npm run build
```
然后浏览器检查关键页面 button 视觉是否一致。

---

### Phase 2: Table 替换（8 个文件）

使用 Ant Design `<Table>` 替换原生 `<table>`。

#### Task 2.A: AgentManagement.tsx

**文件:** `frontend/src/components/AgentStudio/workstation/agent/AgentManagement.tsx`

```tsx
import { Table, Checkbox, Button } from 'antd';

// 替换部分：
const columns: ColumnsType<AgentEntry> = [
  {
    title: <Checkbox checked={mgmt.allOnPageSelected} onChange={mgmt.toggleSelectAll} />,
    key: 'selection',
    width: 40,
    render: (_: unknown, record: AgentEntry) => (
      <Checkbox checked={mgmt.selectedIds.has(record.id)} onChange={() => mgmt.toggleSelect(record.id)} />
    ),
  },
  { title: t('agent.col_name'), dataIndex: 'name', key: 'name', ellipsis: true },
  { title: t('agent.col_team'), dataIndex: 'team', key: 'team' },
  { title: t('agent.col_model'), dataIndex: 'model', key: 'model' },
  {
    title: t('agent.col_status'), dataIndex: 'status', key: 'status',
    render: (status: string) => <Tag>{STATUS_LABEL[status] || status}</Tag>,
  },
  { title: t('agent.col_version'), dataIndex: 'version', key: 'version' },
  {
    title: '', key: 'action', width: 60,
    render: (_: unknown, record: AgentEntry) => (
      <Button type="text" icon={<MoreVertical size={15} />} onClick={() => mgmt.setMenuState(record)} />
    ),
  },
];

// 原 <table> 替换为:
<Table
  columns={columns}
  dataSource={mgmt.items}
  rowKey="id"
  pagination={false}
  size="small"
  rowClassName={(record) => mgmt.selectedIds.has(record.id) ? 'wsta-row-selected' : ''}
/>
```

**注意：** pagination={false} 保留现有 WstaPagination 组件。

#### Task 2.B-2.H: 其余 7 个 Management 文件

**文件列表:**
- `frontend/src/components/AgentStudio/workstation/team/TeamManagement.tsx`
- `frontend/src/components/AgentStudio/workstation/tool/ToolManagement.tsx`
- `frontend/src/components/AgentStudio/workstation/mcp/MCPManagement.tsx`
- `frontend/src/components/AgentStudio/workstation/skill/SkillManagement.tsx`
- `frontend/src/components/AgentStudio/workstation/prompt/PromptManagement.tsx`
- `frontend/src/components/AgentStudio/workstation/output/OutputConstraintManagement.tsx`
- `frontend/src/components/AgentStudio/workstation/logs/LogAudit.tsx`

每个文件使用与 Task 2.A 相同的 `<Table>` 模式替换。

---

### Phase 3: 弹窗迁移（11 个文件）

使用 Ant Design `<Modal>` 替换自定义弹窗。

#### Task 3.A: DeleteConfirmModal.tsx

```tsx
import { Modal, Button } from 'antd';

// 替换前:
// <div className="agentstudio-modal-overlay">
//   <div className="agentstudio-modal">
//     <div className="agentstudio-modal-header"><h3>...</h3><button className="agentstudio-modal-close">...</button></div>
//     <div className="agentstudio-modal-content"><div className="agentstudio-confirm-body">...</div></div>
//     <div className="agentstudio-modal-actions"><button>取消</button><button className="danger">删除</button></div>
//   </div>
// </div>

// 替换后:
<Modal
  title={t('confirm.title')}
  open
  onCancel={onClose}
  footer={[
    <Button key="cancel" onClick={onClose}>{t('common.cancel')}</Button>,
    <Button key="confirm" type="primary" danger onClick={handleConfirm}>{t('sidebar.delete')}</Button>,
  ]}
>
  {/* Keep existing SVG icons, replace CSS classes: */}
  {/* .agentstudio-confirm-body → flex items-center gap-3 py-1 */}
  {/* .agentstudio-confirm-icon → flex items-center justify-center shrink-0, color via inline style */}
  {/* .agentstudio-confirm-text → flex-1 min-w-0 */}
  {/* p tag → m-0 text-sm leading-relaxed text-[var(--color-text-secondary)] */}
</Modal>
```

#### Task 3.B: BatchDeleteModal.tsx

同上，使用 `<Modal>` 替换。

#### Task 3.C: ConfirmModal.tsx

同上，使用 `<Modal>` 替换。

#### Task 3.D: ArchiveConfirmModal.tsx

同上，使用 `<Modal>` 替换。

#### Task 3.E-3.K: 其余弹窗

- `CreateModal.tsx` → `<Modal>` + 保留动态 `width` prop
- `VersionHistoryModal.tsx` → `<Modal>`
- `SettingsModal.tsx` → `<Modal>`
- `NewProjectModal.tsx` → `<Modal>`
- `ApiManagementModal.tsx` → `<Modal>`
- `LoginModal.tsx` → `<Modal>` + 删除 `auth/login.css`
- `ForgotPasswordForm.tsx` → 保留作为 LoginModal 子组件，复用 Modal 上下文

---

### Phase 4: CSS 文件清理

#### Task 4.1: 删除不再使用的 CSS 文件

```bash
rm frontend/src/styles/modals/overlay.css
rm frontend/src/styles/modals/buttons.css
rm frontend/src/styles/modals/confirm.css
rm frontend/src/styles/modals/agent.css
rm frontend/src/styles/modals/api.css
rm frontend/src/styles/modals/newproject.css
rm frontend/src/styles/modals/settings.css
rm frontend/src/styles/modals/responsive.css
rm frontend/src/styles/modals/range-slider.css
rm frontend/src/styles/auth/login.css
```

#### Task 4.2: 更新 modals/index.css

删除指向已删除文件的 `@import`。

```css
/* modals/index.css — 清理后 */
/* 可能全部删除，保留空文件或完全移除 */
```

#### Task 4.3: 更新 main.tsx

删除 `import './styles/auth/login.css';`。

---

## 验证标准

每个 Task 完成后执行：
```bash
cd frontend && npm run build
```
Expected: 0 errors, 0 warnings (除 chunk size 外)

浏览器验证（HMR）：
```
// Button 样式验证
getComputedStyle(document.querySelector('.ant-btn')).padding  // 不应为 0
getComputedStyle(document.querySelector('.ant-btn')).border  // 应有 1px border

// Table 样式验证
getComputedStyle(document.querySelector('.ant-table')).fontSize  // 应为 13px
```

## 回滚策略

每个 Phase/Batch 独立提交。`git revert <commit>` 单批次回滚。
