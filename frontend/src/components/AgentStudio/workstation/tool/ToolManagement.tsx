import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Wrench } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { useToolManagement } from './useToolManagement';
import { TOOL_STATUS_LABEL } from './tool.constants';
import ToolFormModal from './ToolFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import WstaPagination from '../shared/WstaPagination';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { getCategoryTagClass } from '../shared/categoryTag';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';

export default function ToolManagement() {
  const d = useToolManagement();
  const { toast } = useToast();

  const pagedItems = useMemo(() => {
    const start = (d.page - 1) * 7;
    return d.processed.slice(start, start + 7);
  }, [d.processed, d.page]);

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

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('tool.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('tool.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('tool.col_name')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar">
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('tool.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={categoryOptions} />
          <Select style={{ width: 120 }} value={d.statusFilter} onChange={(v) => d.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: TOOL_STATUS_LABEL.active },
            { value: 'disabled', label: TOOL_STATUS_LABEL.disabled },
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={d.openBatchDelete}>{t('tool.batch_delete', String(d.selectedIds.size))}</Button>}
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>{t('tool.new')}</Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <Wrench size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('tool.empty_title')}</div>
            <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{d.search ? t('tool.empty_desc_search') : t('tool.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('tool.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('tool.select_all')} /></th>
            <th scope="col">{t('tool.col_name')}</th>
            <th scope="col">{t('tool.col_category')}</th>
            <th scope="col">{t('tool.col_desc')}</th>
            <th scope="col">{t('tool.col_status')}</th>
            <th scope="col">{t('workstation.createdAt')}</th>
            <th className="w-[100px] text-right" scope="col">{t('tool.col_actions')}</th>
          </tr></thead>
          <tbody>
            {pagedItems.map((item) => (
              <tr key={item.id} className={`${!item.is_builtin && d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}`}>
                <td className="w-10 text-center align-middle p-1 px-2">
                  <input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} disabled={item.is_builtin} aria-label={t('tool.select_item', item.name)} />
                </td>
                <td>
                  <span className="inline-flex items-center max-w-full">
                    <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
                    {item.is_builtin && <span className="ml-1.5 inline-block shrink-0 py-0.5 px-1.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] align-middle">内置</span>}
                  </span>
                </td>
                <td><span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{item.category}</span></td>
                <td><span className="text-sm text-[var(--color-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span></td>
                <td><span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}><span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />{TOOL_STATUS_LABEL[item.status]}</span></td>
                <td><span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span></td>
                <td className="w-[100px] text-right">
                  {item.is_builtin ? (
                    <span className="text-xs text-[var(--color-text-muted)]"></span>
                  ) : (
                    <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
                      <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
                    </Dropdown>
                  )}
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

      {d.isFormOpen && <ToolFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSave} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label="工具" onConfirm={handleDelete} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="工具" onConfirm={handleBatchDelete} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="tool" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
