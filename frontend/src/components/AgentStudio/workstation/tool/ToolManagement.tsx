import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useCallback } from 'react';
import { MoreHorizontal, Edit3, Eye, Trash2, Wrench } from 'lucide-react';
import { useToolManagement } from './useToolManagement';
import { TOOL_STATUS_LABEL } from './tool.constants';
import ToolFormModal from './ToolFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import { getCategoryTagClass } from '../shared/categoryTag';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';
import type { ToolEntry } from './tool.types';

export default function ToolManagement() {
  const d = useToolManagement();
  const { toast } = useToast();

  function handleSave() { void d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('tool.toast_updated') : t('tool.toast_created'), 'success'); }
  function handleDelete() { void d.handleDelete(); toast(t('tool.toast_deleted'), 'success'); }
  function handleBatchDelete() { void d.handleBatchDelete(); toast(t('tool.toast_batch_deleted'), 'success'); }

  const statusDotClass: Record<string, string> = { active: 'wsta-badge-dot-green', disabled: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { active: 'wsta-dot-green', disabled: 'wsta-dot-gray' };

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(d.processed.map((i) => i.category).filter(Boolean)));
    return [
      { value: 'all', label: t('tool.all_categories') },
      ...cats.map((c) => ({ value: c, label: c })),
    ];
  }, [d.processed]);

  const makeMenuItems = useCallback((item: (typeof d.processed)[0]): MenuProps['items'] => {
    if (item.is_builtin) return [];
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('tool.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('tool.history'), onClick: () => d.openHistory(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('tool.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }, [d]);

  const columns: Column<ToolEntry>[] = [
    {
      key: 'name',
      title: t('tool.col_name'),
      render: (item) => (
        <span className="inline-flex items-center max-w-full">
          <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
          {item.is_builtin && <span className="ml-1.5 inline-block shrink-0 py-0.5 px-1.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] align-middle">内置</span>}
        </span>
      ),
    },
    { key: 'category', title: t('tool.col_category'), render: (item) => <span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{item.category}</span> },
    { key: 'description', title: t('tool.col_desc'), render: (item) => <span className="text-sm text-[var(--color-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span> },
    { key: 'status', title: t('tool.col_status'), render: (item) => <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}><span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />{TOOL_STATUS_LABEL[item.status]}</span> },
    { key: 'createdAt', title: t('workstation.createdAt'), render: (item) => <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span> },
    {
      key: 'actions',
      title: t('tool.col_actions'),
      className: 'w-[100px] text-right',
      render: (item) => item.is_builtin ? (
        <span className="text-xs text-[var(--color-text-muted)]"></span>
      ) : (
        <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <ManagementTable
        crud={d}
        label={t('tool.col_name')}
        loadingLabel={t('tool.loading')}
        errorFallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('tool.error_render')}</p></div>}
        columns={columns}
        searchPlaceholder={t('tool.search_placeholder')}
        categoryOptions={categoryOptions}
        categoryValue={d.categoryFilter}
        onCategoryChange={d.setCategoryFilter}
        statusOptions={[
          { value: 'all', label: '全部状态' },
          { value: 'active', label: TOOL_STATUS_LABEL.active },
          { value: 'disabled', label: TOOL_STATUS_LABEL.disabled },
        ]}
        statusValue={d.statusFilter}
        onStatusChange={d.setStatusFilter}
        batchDeleteLabel={t('tool.batch_delete', String(d.selectedIds.size))}
        onBatchDelete={d.openBatchDelete}
        createLabel={t('tool.new')}
        onCreate={d.openCreate}
        selectAllLabel={t('tool.select_all')}
        selectItemLabel={(item) => t('tool.select_item', item.name)}
        rowSelectable={(item) => !item.is_builtin}
        rowClassName={(item) => (!item.is_builtin && d.selectedIds.has(item.id) ? 'wsta-row-selected' : '')}
        emptyIcon={<Wrench size={40} className="text-[var(--color-text-muted)] opacity-50" />}
        emptyTitle={t('tool.empty_title')}
        emptyDescription={t('tool.empty_desc_general')}
        emptySearchDescription={t('tool.empty_desc_search')}
      />
      {d.isFormOpen && <ToolFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSave} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label="工具" onConfirm={handleDelete} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="工具" onConfirm={handleBatchDelete} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="tool" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </>
  );
}
