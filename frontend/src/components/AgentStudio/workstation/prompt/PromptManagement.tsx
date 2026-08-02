import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Trash2, MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { usePromptManagement, PROMPT_STATUS_LABEL, getCategoryLabel, t } from './index';
import PromptFormModal from './PromptFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import WstaPagination from '../shared/WstaPagination';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { getCategoryTagClass } from '../shared/categoryTag';
import { useToast } from '../../../../utils/useToast';
import { formatRelativeTime } from '../../../../utils/relativeTime';

export default function PromptManagement() {
  const d = usePromptManagement();
  const { toast } = useToast();

  function handleSaveWrapper() { d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('prompt.toast_updated') : t('prompt.toast_created'), 'success'); }
  function handleDeleteWrapper() { d.handleDelete(); toast(t('prompt.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { d.handleBatchDelete(); toast(t('prompt.toast_batch_deleted'), 'success'); }

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

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('prompt.loading')}><TableSkeleton rows={5} cols={5} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('prompt.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label="提示词管理">
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label="操作工具栏">
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('prompt.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 140 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={categoryOptions} />
          <Select style={{ width: 120 }} value={d.statusFilter} onChange={(v) => d.setStatusFilter(v)} options={[
            { value: 'all', label: t('prompt.all_status') },
            { value: 'active', label: PROMPT_STATUS_LABEL.active },
            { value: 'draft', label: PROMPT_STATUS_LABEL.draft },
            { value: 'archived', label: PROMPT_STATUS_LABEL.archived },
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => d.openBatchDelete()}>
              {t('prompt.batch_delete', { n: String(d.selectedIds.size) })}
            </Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>
            {t('prompt.new')}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <MessageSquare size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('prompt.empty_title')}</div>
            <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{d.search ? t('prompt.empty_desc_search') : t('prompt.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('prompt.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('prompt.select_all')} /></th>
            <th scope="col">{t('prompt.col_name')}</th>
            <th scope="col">{t('prompt.col_category')}</th>
            <th scope="col">{t('prompt.col_status')}</th>
            <th scope="col">{t('workstation.createdAt')}</th>
            <th className="w-[100px] text-right" scope="col">{t('prompt.col_actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('prompt.select_item', { n: item.name })} /></td>
                <td><span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span></td>
                <td><span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{getCategoryLabel(item.category)}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${item.status === 'active' ? 'wsta-badge-dot-green' : item.status === 'draft' ? 'wsta-badge-dot-gray' : 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${item.status === 'active' ? 'wsta-dot-green' : 'wsta-dot-gray'}`} />
                    {PROMPT_STATUS_LABEL[item.status] || item.status}
                  </span>
                </td>
                <td><span className="text-xs text-[var(--color-text-muted)]">{formatRelativeTime(item.createdAt)}</span></td>
                <td className="w-[100px] text-right">
                  <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
                    <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <WstaPagination
        current={d.page}
        total={d.processed.length}
        pageSize={7}
        onChange={(p) => d.setPage(p)}
      />

      {d.isFormOpen && <PromptFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label={t('prompt.edit')} onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="提示词" onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="prompt" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
