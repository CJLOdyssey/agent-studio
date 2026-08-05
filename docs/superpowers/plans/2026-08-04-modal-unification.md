# 弹窗统一重构（Modal 底座单一化 + 确认弹窗合并）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除三套平行弹窗基础设施，统一到 `shared/Modal` 单一底座，让确认弹窗从 5 种实现收敛为 1 种，消除重复 overlay 模板。

**Architecture:** 以 `frontend/src/components/shared/Modal.tsx` 为唯一弹窗底座（已具备 overlay/Escape/焦点陷阱/可选 header/footer 边线）。新增通用 `ConfirmDialog` 组件（基于 Modal），替换 DeleteConfirmModal、BatchDeleteModal、ArchiveConfirmModal、TeamTree 内联确认弹窗。删除无真实调用方的 `CreateModal`（死代码）。FormModal 系列改为复用 Modal 底座。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + Vitest + React Testing Library

## Global Constraints

- 所有弹窗最终只能通过 `shared/Modal` 渲染（或基于它构建的派生组件）
- 不改变任何调用方传入的 props 契约；只改被替换组件内部实现
- 所有现有测试必须保持通过（更新测试只允许因 DOM 结构/文案变化而断言变化，不允许删测试）
- 保持现有视觉样式：圆角 `rounded-xl`、背景 `bg-[var(--color-surface-raised)]`、边框与圆角边线规则、间距 px-6/py-4 等
- 保持 i18n：所有文案继续走 `useTranslation`，不硬编码中文（除既有已硬编码的中文如 DeleteConfirmModal 的确认文案）
- 单文件不超过 400 行

---

### Task 1: 增强 shared/Modal 支持 aria-label 与宽度

**Files:**
- Modify: `frontend/src/components/shared/Modal.tsx`
- Test: `frontend/src/components/shared/__tests__/Modal.test.tsx`

**Interfaces:**
- Produces: `Modal` 新增可选 props：`ariaLabel?: string`、`width?: number`

当前 Modal 不支持设置 dialog 的 `aria-label`（各 FormModal 用 `aria-label={title}` 满足 a11y），也不支持直接控制宽度（只能靠 className 拼 max-w）。新增这两个可选 prop，向后兼容。

- [ ] **Step 1: 写失败测试**

在 `Modal.test.tsx` 末尾新增两个用例：

```tsx
it('sets aria-label when provided', () => {
  render(
    <TestProviders>
      <Modal title="Test" onClose={onClose} ariaLabel="Custom Dialog">
        <p>Content</p>
      </Modal>
    </TestProviders>,
  );
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Custom Dialog');
});

it('applies width style when provided', () => {
  const { container } = render(
    <TestProviders>
      <Modal title="Test" onClose={onClose} width={480}>
        <p>Content</p>
      </Modal>
    </TestProviders>,
  );
  const dialog = container.querySelector('[role="dialog"]');
  expect(dialog).toHaveStyle({ maxWidth: '480px' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/shared/__tests__/Modal.test.tsx`
Expected: 两个新用例 FAIL（aria-label 缺失、max-width 未设置）

- [ ] **Step 3: 实现**

修改 `Props` 接口与组件签名：

```tsx
interface Props {
  title: string | ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  hideHeaderBorder?: boolean;
  hideFooterBorder?: boolean;
  bodyClassName?: string;
  ariaLabel?: string;
  width?: number;
}
```

函数签名解构加入 `ariaLabel, width`，dialog div 上：

```tsx
<div
  className={...}
  style={width ? { maxWidth: width } : undefined}
  aria-label={ariaLabel}
  ...
>
```

注意：现有 `style` 未使用，直接新增 `style={width ? { maxWidth: width } : undefined}` 即可。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/shared/__tests__/Modal.test.tsx`
Expected: 全部 PASS（原有 14 个 + 新 2 个）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/shared/Modal.tsx frontend/src/components/shared/__tests__/Modal.test.tsx
git commit -m "feat(frontend): Modal supports aria-label and width props"
```

---

### Task 2: 新建通用 ConfirmDialog（基于 Modal）

**Files:**
- Create: `frontend/src/components/shared/ConfirmDialog.tsx`
- Test: Create `frontend/src/components/shared/__tests__/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `ConfirmDialog` 组件，props：
```ts
interface ConfirmDialogProps {
  title: string | ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: ReactNode;               // 标题左侧图标，默认根据 danger 显示警告图标
  onConfirm: () => void;
  onCancel: () => void;
  width?: number;
}
```
- Consumes: `Modal`（Task 1 增强版，需要 `ariaLabel`/`width`）

这是确认弹窗的唯一实现，合并现有 ConfirmModal / DeleteConfirmModal / BatchDeleteModal / ArchiveConfirmModal 的语义。

- [ ] **Step 1: 写失败测试**

创建 `ConfirmDialog.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '@/test/setup';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'confirm.confirm': '确认',
        'confirm.cancel': '取消',
        'confirm.danger': '危险操作',
      };
      return map[key] || key;
    },
  }),
}));

import ConfirmDialog from '@/components/shared/ConfirmDialog';

describe('ConfirmDialog', { tags: ['unit'] }, () => {
  it('renders title and message', () => {
    render(
      <TestProviders>
        <ConfirmDialog title="Delete Item" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('shows danger label when danger', () => {
    render(
      <TestProviders>
        <ConfirmDialog title="T" message="M" danger onConfirm={vi.fn()} onCancel={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByText('危险操作')).toBeInTheDocument();
  });

  it('calls onConfirm with custom label', () => {
    const onConfirm = vi.fn();
    render(
      <TestProviders>
        <ConfirmDialog title="T" message="M" confirmLabel="Yes" onConfirm={onConfirm} onCancel={vi.fn()} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByText('Yes'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel with custom cancel label', () => {
    const onCancel = vi.fn();
    render(
      <TestProviders>
        <ConfirmDialog title="T" message="M" cancelLabel="No" onConfirm={vi.fn()} onCancel={onCancel} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByText('No'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('has no header/footer border lines', () => {
    const { container } = render(
      <TestProviders>
        <ConfirmDialog title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </TestProviders>,
    );
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('[class*="border-b"]')).toBeNull();
    expect(dialog.querySelector('[class*="border-t"]')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/components/shared/__tests__/ConfirmDialog.test.tsx`
Expected: FAIL（组件不存在）

- [ ] **Step 3: 实现 ConfirmDialog**

```tsx
import { AlertTriangle, OctagonX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import Modal from './Modal';

interface ConfirmDialogProps {
  title: string | ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  width?: number;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel: confirmLabelProp,
  cancelLabel: cancelLabelProp,
  danger,
  icon,
  onConfirm,
  onCancel,
  width,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmLabel = confirmLabelProp ?? t('confirm.confirm');
  const cancelLabel = cancelLabelProp ?? t('confirm.cancel');
  const Icon = icon ?? (danger ? <OctagonX size={24} className="text-[var(--color-danger)]" aria-label={t('confirm.danger')} /> : <AlertTriangle size={24} className="text-[var(--color-accent-soft)]" aria-label={t('confirm.info')} />);

  return (
    <Modal
      title={title}
      onClose={onCancel}
      hideHeaderBorder
      hideFooterBorder
      ariaLabel={typeof title === 'string' ? title : undefined}
      width={width}
      className="w-[var(--modal-sm)]"
      footer={
        <>
          <button
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 ${
              danger
                ? 'bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_25%,transparent)]'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4 p-6">
        {Icon}
        <div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{danger ? t('confirm.danger') : t('confirm.info')}</p>
          <p>{message}</p>
        </div>
      </div>
    </Modal>
  );
}
```

注意 `t('confirm.info')` 需存在于 i18n 或回退为原文（现有 ConfirmModal 已依赖它，无风险）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/shared/__tests__/ConfirmDialog.test.tsx`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/shared/ConfirmDialog.tsx frontend/src/components/shared/__tests__/ConfirmDialog.test.tsx
git commit -m "feat(frontend): add generic ConfirmDialog on Modal base"
```

---

### Task 3: ConfirmModal 改为复用 ConfirmDialog

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/ConfirmModal.tsx`
- Test: `frontend/src/components/AgentStudio/modals/__tests__/ConfirmModal.test.tsx`（保留，仅微调 import 若需）

**Interfaces:**
- Consumes: `ConfirmDialog`（Task 2）
- Produces: `ConfirmModal` 保持现有 props 签名不变（`title/message/confirmLabel/onConfirm/onCancel/danger`），对外契约不变

`ConfirmModal` 与 `ConfirmDialog` 逻辑完全相同，改为薄封装委托。

- [ ] **Step 1: 先运行现有测试确认基线**

Run: `npx vitest run src/components/AgentStudio/modals/__tests__/ConfirmModal.test.tsx`
Expected: 当前 PASS（重构前基线）

- [ ] **Step 2: 重写 ConfirmModal 为委托**

```tsx
import ConfirmDialog from '../../shared/ConfirmDialog';
import type { ReactNode } from 'react';

interface Props {
  title: string | ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal(props: Props) {
  return <ConfirmDialog {...props} />;
}
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npx vitest run src/components/AgentStudio/modals/__tests__/ConfirmModal.test.tsx`
Expected: 全部 PASS（原 4 个用例：title/message、danger、info、自定义 label 均覆盖）

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/AgentStudio/modals/ConfirmModal.tsx
git commit -m "refactor(frontend): ConfirmModal delegates to shared ConfirmDialog"
```

---

### Task 4: DeleteConfirmModal 复用 ConfirmDialog

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/shared/DeleteConfirmModal.tsx`
- Test: `frontend/src/components/AgentStudio/workstation/shared/__tests__/DeleteConfirmModal.test.tsx`（更新断言）

**Interfaces:**
- Consumes: `ConfirmDialog`
- Produces: `DeleteConfirmModal` 保持 props `{ name; label?; onConfirm; onClose }` 不变；7 个调用方（AgentManagement/WorkflowList/MCPManagement/PromptManagement/SkillManagement/TeamManagement/ToolManagement）零改动

- [ ] **Step 1: 运行现有测试确认基线**

Run: `npx vitest run src/components/AgentStudio/workstation/shared/__tests__/DeleteConfirmModal.test.tsx`
Expected: 当前 PASS

- [ ] **Step 2: 更新测试（文案改为走 t，标题经 ConfirmDialog 渲染为 <h3>）**

现有测试断言 `getByRole('heading', { name: 'Confirm Delete' })`——ConfirmDialog 用 Modal 渲染标题为 `<h3>`，仍匹配。但 ConfirmDialog 的确认按钮文案来自 `confirmLabel`，需传入 `t('workstation.confirmDelete')`。测试 mock 的 t map 已有该 key。取消按钮用 `cancelLabel` 传入 `t('workstation.cancel')`。

原测试第二条 `getByRole('button', { name: 'Confirm Delete' })` 断言确认按钮——ConfirmDialog 确认按钮文案 = confirmLabel，OK。第三条 `getByText('Cancel')`——取消按钮 = cancelLabel，OK。

故测试**无需改动**，先直接运行确认。

- [ ] **Step 3: 重写组件**

```tsx
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../../shared/ConfirmDialog';

interface Props {
  name: string;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmModal({ name, label = '项目', onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={t('workstation.confirmDelete')}
      message={
        <>
          确定要删除 {label} <strong>「{name}」</strong> 吗？此操作不可撤销。
        </>
      }
      confirmLabel={t('workstation.confirmDelete')}
      cancelLabel={t('workstation.cancel')}
      danger
      onConfirm={onConfirm}
      onCancel={onClose}
      width={420}
    />
  );
}
```

注意：原样式 maxWidth 420，用 width=420 保持。ConfirmDialog 的 `className="w-[var(--modal-sm)]"` 与内联 style maxWidth 并存——modal-sm 需小于 420 时以 width 生效，需要确认 modal-sm 值；若 modal-sm > 420，style 会覆盖。为稳妥，给 ConfirmDialog 增加不强制 className 的能力？——不，保持简单：Modal 的 className 拼在 style 之前由内联 style 覆盖 maxWidth（Tailwind max-w 是 CSS class，内联 style 优先级更高，宽取 min(90%, modal-sm?)。实测验证后若宽度异常，将 ConfirmDialog className 改为可选。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/AgentStudio/workstation/shared/__tests__/DeleteConfirmModal.test.tsx`
Expected: 全部 PASS

- [ ] **Step 5: 运行依赖它的 7 个管理组件测试，确认调用方无回归**

Run:
```bash
npx vitest run src/components/AgentStudio/workstation/agent src/components/AgentStudio/workstation/workflow src/components/AgentStudio/workstation/mcp src/components/AgentStudio/workstation/prompt src/components/AgentStudio/workstation/skill src/components/AgentStudio/workstation/team src/components/AgentStudio/workstation/tool
```
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/AgentStudio/workstation/shared/DeleteConfirmModal.tsx
git commit -m "refactor(frontend): DeleteConfirmModal delegates to ConfirmDialog"
```

---

### Task 5: BatchDeleteModal 复用 ConfirmDialog

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/shared/BatchDeleteModal.tsx`
- Test: `frontend/src/components/AgentStudio/workstation/shared/__tests__/BatchDeleteModal.test.tsx`（若断言文案不变则不动）

**Interfaces:**
- Consumes: `ConfirmDialog`
- Produces: `BatchDeleteModal` 保持 props `{ count; label?; onConfirm; onClose }` 不变；7 个调用方零改动

- [ ] **Step 1: 运行现有测试基线**

Run: `npx vitest run src/components/AgentStudio/workstation/shared/__tests__/BatchDeleteModal.test.tsx`
Expected: PASS

- [ ] **Step 2: 重写组件**

```tsx
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../../shared/ConfirmDialog';

interface Props {
  count: number;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BatchDeleteModal({ count, label = 'Agent', onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={t('workstation.batchDelete')}
      message={
        <>
          确定要删除选中的 <strong>{count}</strong> 个 {label} 吗？此操作不可撤销。
        </>
      }
      confirmLabel={t('workstation.confirmDelete')}
      cancelLabel={t('workstation.cancel')}
      danger
      onConfirm={onConfirm}
      onCancel={onClose}
      width={420}
    />
  );
}
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npx vitest run src/components/AgentStudio/workstation/shared/__tests__/BatchDeleteModal.test.tsx`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/AgentStudio/workstation/shared/BatchDeleteModal.tsx
git commit -m "refactor(frontend): BatchDeleteModal delegates to ConfirmDialog"
```

---

### Task 6: ArchiveConfirmModal 复用 ConfirmDialog

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx`
- Test: 无现有测试；验证方式为调用方 TabRenderer 相关集成测试

**Interfaces:**
- Consumes: `ConfirmDialog`
- Produces: `ArchiveConfirmModal` 保持 props `{ kindName; name; onArchive; onCancel }` 不变；唯一调用方 TabRenderer.tsx 零改动

- [ ] **Step 1: 重写组件**

```tsx
import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../shared/ConfirmDialog';

interface Props {
  kindName: string;
  name: string;
  onArchive: () => void;
  onCancel: () => void;
}

export default function ArchiveConfirmModal({ kindName, name, onArchive, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={
        <div className="flex items-center gap-2">
          <Archive size={16} />
          {t('workstation.archiveConfirmTitle')}
        </div>
      }
      message={t('workstation.archiveConfirmDesc', { tool: kindName, name })}
      confirmLabel={t('workstation.archiveBtn')}
      cancelLabel={t('workstation.cancel')}
      icon={<Archive size={24} className="text-[var(--color-accent)]" />}
      onConfirm={onArchive}
      onCancel={onCancel}
      width={400}
    />
  );
}
```

注意原组件标题带 Archive 图标 + 确认按钮也带图标；确认按钮图标在 ConfirmDialog 不支持——可接受（按钮文案即足够），保持视觉接近。

- [ ] **Step 2: 运行依赖测试（AgentConfigModal/TabRenderer 链）**

Run: `npx vitest run src/components/AgentStudio/modals/__tests__/AgentConfigModal.test.tsx`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/AgentStudio/modals/ArchiveConfirmModal.tsx
git commit -m "refactor(frontend): ArchiveConfirmModal delegates to ConfirmDialog"
```

---

### Task 7: TeamTree 内联确认弹窗改用 ConfirmDialog

**Files:**
- Modify: `frontend/src/components/AgentStudio/sidebar/TeamTree.tsx`
- Test: `frontend/src/components/AgentStudio/sidebar/__tests__/TeamTree.test.tsx`、`TeamTree.state.test.tsx`（现有 confirm-delete 用例需保持）

**Interfaces:**
- Consumes: `ConfirmDialog`
- Produces: TeamTree 不再自绘两个内联 createPortal 弹窗（confirmDelete + validationWarning），改用 ConfirmDialog

TeamTree.tsx 342-390（confirmDelete）与 392-431（validationWarning）两段内联弹窗是重复模板，替换为 ConfirmDialog。

- [ ] **Step 1: 运行现有测试基线**

Run: `npx vitest run src/components/AgentStudio/sidebar/__tests__/TeamTree.test.tsx src/components/AgentStudio/sidebar/__tests__/TeamTree.state.test.tsx`
Expected: PASS（基线）

- [ ] **Step 2: 替换 confirmDelete 弹窗**

在文件顶部 import ConfirmDialog。将 `{confirmDelete && createPortal(...)}` 整段替换为：

```tsx
{confirmDelete && (
  <ConfirmDialog
    title={t('confirm.title')}
    message={
      confirmDelete.type === 'team'
        ? t('confirm.deleteTeamConfirm')
        : t('confirm.deleteAgentConfirm')
    }
    confirmLabel={t('sidebar.delete')}
    danger
    onConfirm={confirmDeleteAction}
    onCancel={() => setConfirmDelete(null)}
  />
)}
```

保留原 createPortal 的其它用途（teamMenu/agentMenu 仍走 portal）。

- [ ] **Step 3: 替换 validationWarning 弹窗**

```tsx
{validationWarning && (
  <ConfirmDialog
    title={t('confirm.tip')}
    message={validationWarning.message}
    confirmLabel={t('confirm.confirm')}
    onConfirm={() => setValidationWarning(null)}
    onCancel={() => setValidationWarning(null)}
  />
)}
```

注意：原 validationWarning 确认按钮仅关闭弹窗（不调用 onConfirm，该字段从未被设置）。保持行为一致。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/AgentStudio/sidebar/__tests__/TeamTree.test.tsx src/components/AgentStudio/sidebar/__tests__/TeamTree.state.test.tsx src/components/AgentStudio/sidebar/__tests__/TeamTree.interaction.test.tsx`
Expected: 全部 PASS（用例断言 `confirm.title`、`confirm.deleteTeamConfirm`、`confirm.tip` 文本与 `role="dialog"` 均继续满足）

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/AgentStudio/sidebar/TeamTree.tsx
git commit -m "refactor(frontend): TeamTree inline confirm dialogs use ConfirmDialog"
```

---

### Task 8: 删除无调用方的 CreateModal（死代码）

**Files:**
- Delete: `frontend/src/components/AgentStudio/workstation/shared/CreateModal.tsx`
- Delete: `frontend/src/components/AgentStudio/workstation/shared/__tests__/CreateModal.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 移除死代码；全仓无 CreateModal import（已 grep 确认仅测试文件引用）

- [ ] **Step 1: 全仓确认无真实引用**

Run: `grep -rn "CreateModal" frontend/src --include="*.tsx" | grep -v __tests__`
Expected: 无输出（除测试外无引用）

- [ ] **Step 2: 删除文件**

```bash
git rm frontend/src/components/AgentStudio/workstation/shared/CreateModal.tsx
git rm frontend/src/components/AgentStudio/workstation/shared/__tests__/CreateModal.test.tsx
```

- [ ] **Step 3: 运行全量前端测试确认无残留引用**

Run: `npx vitest run 2>&1 | tail -20`
Expected: 全部 PASS，无模块解析错误

- [ ] **Step 4: 提交**

```bash
git commit -m "chore(frontend): remove dead CreateModal component"
```

---

### Task 9: FormModal 系列复用 Modal 底座（Tool/MCP/Prompt/Skill/Output）

**Files:**
- Modify:
  - `frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx`
  - `frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx`
  - `frontend/src/components/AgentStudio/workstation/prompt/PromptFormModal.tsx`
  - `frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx`
  - `frontend/src/components/AgentStudio/workstation/output/OutputFormModal.tsx`
- Test: 各 `__tests__/*FormModal.test.tsx` 断言若依赖 `role="dialog"` + aria-label 需更新

**Interfaces:**
- Consumes: `Modal`（Task 1 增强：ariaLabel/width）
- Produces: 5 个 FormModal 的 overlay/header/footer 骨架替换为 Modal，body 内容不变

这 5 个 FormModal 骨架完全相同（`fixed inset-0 ... rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] max-w-[var(--modal-m)]` + header + body + footer），仅 body 与宽度不同。提取为 Modal 后每个组件只剩标题/children/footer。

- [ ] **Step 1: 逐文件替换骨架（以 MCPFormModal 为例）**

先读各 FormModal 现状（codegraph_explore 已覆盖），将外层自绘 div 替换为：

```tsx
<Modal
  title={editingItem ? t('mcp.form_title_edit') : t('mcp.form_title_new')}
  onClose={onClose}
  ariaLabel={...}
  width={560}
  bodyClassName="px-5 pb-5 overflow-y-auto flex-1 min-h-0 flex flex-col"
  footer={...}  // 原 footer 两个按钮
>
  {errors && ...}
  {children/form body}
</Modal>
```

每个 FormModal 的 title、footer 按钮、body 从原 JSX 搬移，删除自绘 overlay 外层 div 与重复 header。

- [ ] **Step 2: 更新各测试断言（aria-label 从 role dialog 到 aria-label attr）**

现有测试如 `OutputFormModal.test.tsx` 断言 `role="dialog"` 与 aria-label——Modal 支持 ariaLabel 后匹配。逐个运行确认，失败则更新断言为 Modal 结构。

- [ ] **Step 3: 运行各模块测试确认通过**

Run:
```bash
npx vitest run src/components/AgentStudio/workstation/tool src/components/AgentStudio/workstation/mcp src/components/AgentStudio/workstation/prompt src/components/AgentStudio/workstation/skill src/components/AgentStudio/workstation/output
```
Expected: 全部 PASS

- [ ] **Step 4: 浏览器实测 5 个表单弹窗视觉无回归**

打开前端 5174，逐个打开 Tool/MCP/Prompt/Skill/Output 表单，确认骨架样式与重构前一致（圆角/背景/边线/间距）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx frontend/src/components/AgentStudio/workstation/prompt/PromptFormModal.tsx frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx frontend/src/components/AgentStudio/workstation/output/OutputFormModal.tsx
git commit -m "refactor(frontend): FormModal series reuse Modal base"
```

---

### Task 10: TeamFormModal / AgentFormModal 复用 Modal 底座

**Files:**
- Modify:
  - `frontend/src/components/AgentStudio/workstation/team/TeamFormModal.tsx`
  - `frontend/src/components/AgentStudio/workstation/agent/AgentFormModal.tsx`
- Test: `TeamFormModal.test.tsx`、`AgentFormModal.test.tsx`

**Interfaces:**
- Consumes: `Modal`
- Produces: 两个复杂表单弹窗骨架复用 Modal，body（含 ResourcePickerSection 等）不动

这两个带 icon 标题头 + 大表单，骨架同样替换为 Modal，`title` 传 `<div className="flex items-center gap-3">...`。

- [ ] **Step 1: 替换 TeamFormModal 骨架**

外层自绘 div → `<Modal title={<div className="flex items-center gap-3"><Users size={16} .../><h3>...</h3></div>} onClose={onClose} width={...} bodyClassName="px-5 pb-5 overflow-y-auto flex-1 min-h-0 flex flex-col" footer={原 footer 按钮}>...body...</Modal>`。TeamFormModal 测试断言 `max-w-[var(--modal-sm)]`，改用 `width` 时测试需更新为内联 maxWidth。

- [ ] **Step 2: 替换 AgentFormModal 骨架**

同法，保留 formErrors 区块与 ResourcePickerSection。

- [ ] **Step 3: 更新两测试断言并运行**

Run: `npx vitest run src/components/AgentStudio/workstation/team src/components/AgentStudio/workstation/agent`
Expected: PASS

- [ ] **Step 4: 浏览器实测**

打开 Team/Agent 表单，确认骨架视觉无回归。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/AgentStudio/workstation/team/TeamFormModal.tsx frontend/src/components/AgentStudio/workstation/agent/AgentFormModal.tsx
git commit -m "refactor(frontend): TeamFormModal and AgentFormModal reuse Modal base"
```

---

### Task 11: 最终验证（全量测试 + lint）

**Files:**
- Test: 全量

- [ ] **Step 1: 全量前端测试**

Run: `npx vitest run 2>&1 | tail -20`
Expected: 全部 PASS

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: 无错误（若项目有独立 typecheck 脚本则用它）

- [ ] **Step 3: 确认无残留自绘 overlay**

Run: `grep -rn "fixed inset-0 bg-\[var(--color-overlay)\]" frontend/src/components --include="*.tsx"`
Expected: 仅 `shared/Modal.tsx` 一处（唯一底座）；LoginModal/AgentConfigModal/ProviderEditModal/WorkstationPage/TeamMemberManager/ResourcePickerModal/VersionHistoryModal 若仍有则记录为已知例外（不在本次范围）

- [ ] **Step 4: 收尾说明**

向用户报告：确认弹窗 5 种→1 种（ConfirmDialog），overlay 模板消除到 Modal 唯一，CreateModal 死代码已删。
