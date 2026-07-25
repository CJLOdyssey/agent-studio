import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Wrench } from 'lucide-react';
import { useToolManagement } from './useToolManagement';
import { TOOL_CATEGORIES, TOOL_STATUS_LABEL } from './tool.constants';
import ToolFormModal from './ToolFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import WstaPagination from '../shared/WstaPagination';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

export default function ToolManagement() {
  const d = useToolManagement();
  const { toast } = useToast();

  function handleSave() { d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('tool.toast_updated') : t('tool.toast_created'), 'success'); }
  function handleDelete() { d.handleDelete(); toast(t('tool.toast_deleted'), 'success'); }
  function handleBatchDelete() { d.handleBatchDelete(); toast(t('tool.toast_batch_deleted'), 'success'); }

  const statusDotClass: Record<string, string> = { active: 'wsta-badge-dot-green', disabled: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { active: 'wsta-dot-green', disabled: 'wsta-dot-gray' };

  function makeMenuItems(item: typeof d.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('tool.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('tool.history'), onClick: () => d.openHistory(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('tool.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('tool.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-col items-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('tool.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('tool.col_name')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar">
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('tool.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={[
            { value: 'all', label: t('tool.all_categories') },
            ...TOOL_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]} />
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
      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
            <Wrench size={40} className="text-[var(--da-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--da-text-secondary)]">{t('tool.empty_title', d.search ? '' : '')}</div>
            <div className="text-sm text-[var(--da-text-muted)] max-w-80 leading-relaxed">{d.search ? t('tool.empty_desc_search') : t('tool.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-[var(--da-font-size-sm)]" role="grid" aria-label={t('tool.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('tool.select_all')} /></th>
            <th scope="col">{t('tool.col_name')}</th>
            <th scope="col">{t('tool.col_category')}</th>
            <th scope="col">{t('tool.col_desc')}</th>
            <th scope="col">{t('tool.col_status')}</th>
            <th scope="col">{t('tool.col_version')}</th>
            <th className="w-[60px] text-right" scope="col">{t('tool.col_actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('tool.select_item', item.name)} /></td>
                <td><span className="font-semibold text-[var(--da-text-primary)] -tracking-[0.01em]">{item.name}</span></td>
                <td><span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">{item.category}</span></td>
                <td><span className="text-sm text-[var(--da-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {TOOL_STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td><span className="font-mono text-xs text-[var(--da-text-muted)]">{item.version}</span></td>
                <td className="w-[60px] text-right">
                  <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
                    <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--da-text-muted)] cursor-pointer transition-all hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]"><MoreHorizontal size={14} /></button>
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
        pageSize={5}
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
