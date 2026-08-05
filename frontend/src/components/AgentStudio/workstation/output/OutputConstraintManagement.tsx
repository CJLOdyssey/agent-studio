import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useState, useMemo } from 'react';
import { MoreHorizontal, Edit3, Trash2, FileText, Eye } from 'lucide-react';
import type { OutputEntry, OutputFormData } from './output.types';
import { useOutputManagement } from './useOutputManagement';
import OutputFormModal from './OutputFormModal';
import { getCategoryTagClass } from '../shared/categoryTag';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import type { GenericCrudReturn } from '../shared/useGenericCrud';
import Modal from '@/components/shared/Modal';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';

export default function OutputConstraintManagement() {
  const d = useOutputManagement();
  const { toast } = useToast();
  const [previewItem, setPreviewItem] = useState<OutputEntry | null>(null);

  function handleSave() {
    const ok = d.handleSave();
    if (ok) toast(d.editingId ? t('output.toast_updated') : t('output.toast_created'), 'success');
  }
  function handleRemove(id: string) { d.removeItem(id); toast(t('output.toast_deleted'), 'success'); }
  function handleBatchRemove() { d.removeMultiple(d.selectedIds); toast(t('output.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { active: 'wsta-badge-dot-green', draft: 'wsta-badge-dot-gray', archived: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { active: 'wsta-dot-green', draft: 'wsta-dot-gray', archived: 'wsta-dot-gray' };
  const statusLabel: Record<string, string> = { active: t('output.status_active'), draft: t('output.status_draft'), archived: t('output.status_archived') };

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(d.filtered.map((i) => i.category).filter(Boolean)));
    return [
      { value: 'all', label: t('output.all_categories') },
      ...cats.map((c) => ({ value: c, label: c })),
    ];
  }, [d.filtered]);

  function makeMenuItems(item: OutputEntry): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('output.edit'), onClick: () => d.openEdit(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('output.delete'), onClick: () => handleRemove(item.id), danger: true },
    ];
  }

  const columns: Column<OutputEntry>[] = [
    {
      key: 'name',
      title: t('output.col_name'),
      render: (item) => (
        <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
      ),
    },
    {
      key: 'content',
      title: t('output.col_content'),
      render: (item) => (
        <span className="inline-flex items-center gap-2 max-w-[300px]">
          <span className="text-sm text-[var(--color-text-secondary)] block max-w-[240px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.content}>{item.content}</span>
          <button className="flex items-center justify-center w-6 h-6 shrink-0 bg-transparent border-none rounded text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={() => setPreviewItem(item)} aria-label={t('output.preview')}><Eye size={13} /></button>
        </span>
      ),
    },
    {
      key: 'category',
      title: t('output.col_category'),
      render: (item) => (
        <span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{item.category}</span>
      ),
    },
    {
      key: 'status',
      title: t('output.col_status'),
      render: (item) => (
        <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
          <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
          {statusLabel[item.status] || item.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: t('workstation.createdAt'),
      render: (item) => (
        <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      title: t('output.col_actions'),
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
        crud={d as unknown as GenericCrudReturn<OutputEntry, OutputFormData>}
        label={t('output.col_name')}
        loadingLabel={t('output.loading')}
        errorFallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('output.error_render')}</p></div>}
        columns={columns}
        searchPlaceholder={t('output.search_placeholder')}
        categoryOptions={categoryOptions}
        categoryValue={d.categoryFilter}
        onCategoryChange={d.setCategoryFilter}
        statusOptions={[
          { value: 'all', label: t('output.all_status') },
          { value: 'active', label: statusLabel.active },
          { value: 'draft', label: statusLabel.draft },
          { value: 'archived', label: statusLabel.archived },
        ]}
        statusValue={d.statusFilter}
        onStatusChange={d.setStatusFilter}
        createLabel={t('output.new')}
        onCreate={d.openCreate}
        batchDeleteLabel={t('output.batch_delete', String(d.selectedIds.size))}
        onBatchDelete={handleBatchRemove}
        selectAllLabel={t('output.select_all')}
        selectItemLabel={(item) => t('output.select_item', item.name)}
        emptyIcon={<FileText size={40} className="text-[var(--color-text-muted)] opacity-50" />}
        emptyTitle={t('output.empty_title')}
        emptyDescription={t('output.empty_desc_general')}
        emptySearchDescription={t('output.empty_desc_search')}
      />

      {d.isFormOpen && <OutputFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSave} onClose={d.closeForm} formErrors={d.formErrors} />}

      {previewItem && (
        <Modal
          title={
            <div className="flex items-center gap-3">
              <FileText size={16} />
              <h3>{previewItem.name}</h3>
            </div>
          }
          onClose={() => setPreviewItem(null)}
          hideHeaderBorder
          hideFooterBorder
          width={560}
          ariaLabel={t('output.preview_title')}
          bodyClassName="px-6 pb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`wsta-tag-pill ${getCategoryTagClass(previewItem.category)}`}>{previewItem.category}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(previewItem.createdAt)}</span>
          </div>
          <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 font-sans">{previewItem.content}</pre>
        </Modal>
      )}
    </>
  );
}
