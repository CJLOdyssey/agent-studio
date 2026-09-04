import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, Edit3, Trash2, MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { usePromptManagement, PROMPT_STATUS_LABEL, getCategoryLabel, t } from './index';
import type { PromptEntry } from './types';
import PromptFormModal from './PromptFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import { getCategoryTagClass } from '../shared/categoryTag';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';

export default function PromptManagement() {
  const d = usePromptManagement();
  const { toast } = useToast();

  function handleSaveWrapper() { void d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('prompt.toast_updated') : t('prompt.toast_created'), 'success'); }
  function handleDeleteWrapper() { void d.handleDelete(); toast(t('prompt.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { void d.handleBatchDelete(); toast(t('prompt.toast_batch_deleted'), 'success'); }

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(d.processed.map((i) => i.category).filter(Boolean)));
    return [
      { value: 'all', label: t('prompt.all_categories') },
      ...cats.map((c) => ({ value: c, label: getCategoryLabel(c) })),
    ];
  }, [d.processed]);

  function makeMenuItems(item: typeof d.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('prompt.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <MessageSquare size={14} />, label: t('prompt.history'), onClick: () => d.openHistory(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('prompt.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }

  const columns: Column<PromptEntry>[] = [
    {
      key: 'name',
      title: t('prompt.col_name'),
      render: (item) => (
        <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
      ),
    },
    { key: 'category', title: t('prompt.col_category'), render: (item) => <span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{getCategoryLabel(item.category)}</span> },
    {
      key: 'status',
      title: t('prompt.col_status'),
      render: (item) => (
        <span className={`wsta-badge-dot ${item.status === 'active' ? 'wsta-badge-dot-green' : 'wsta-badge-dot-gray'}`}>
          <span className={`wsta-dot ${item.status === 'active' ? 'wsta-dot-green' : 'wsta-dot-gray'}`} />
          {PROMPT_STATUS_LABEL[item.status] || item.status}
        </span>
      ),
    },
    { key: 'createdAt', title: t('workstation.createdAt'), render: (item) => <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span> },
    {
      key: 'actions',
      title: t('prompt.col_actions'),
      className: 'w-[100px] text-right',
      render: (item) => (
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
        label={t('prompt.col_name')}
        loadingLabel={t('prompt.loading')}
        errorFallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('prompt.error_render')}</p></div>}
        columns={columns}
        searchPlaceholder={t('prompt.search_placeholder')}
        categoryOptions={categoryOptions}
        categoryValue={d.categoryFilter}
        categorySelectWidth={140}
        onCategoryChange={d.setCategoryFilter}
        statusOptions={[
          { value: 'all', label: t('prompt.all_status') },
          { value: 'active', label: PROMPT_STATUS_LABEL.active },
          { value: 'draft', label: PROMPT_STATUS_LABEL.draft },
          { value: 'archived', label: PROMPT_STATUS_LABEL.archived },
        ]}
        statusValue={d.statusFilter}
        onStatusChange={d.setStatusFilter}
        batchDeleteLabel={t('prompt.batch_delete', { n: String(d.selectedIds.size) })}
        onBatchDelete={d.openBatchDelete}
        createLabel={t('prompt.new')}
        onCreate={d.openCreate}
        selectAllLabel={t('prompt.select_all')}
        selectItemLabel={(item) => t('prompt.select_item', { n: item.name })}
        emptyIcon={<MessageSquare size={40} className="text-[var(--color-text-muted)] opacity-50" />}
        emptyTitle={t('prompt.empty_title')}
        emptyDescription={t('prompt.empty_desc_general')}
        emptySearchDescription={t('prompt.empty_desc_search')}
      />
      {d.isFormOpen && <PromptFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label={t('prompt.edit')} onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="提示词" onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="prompt" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </>
  );
}
