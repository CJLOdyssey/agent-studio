import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Trash2, FileText } from 'lucide-react';
import type { OutputEntry } from './output.types';
import { useOutputManagement } from './useOutputManagement';
import OutputFormModal from './OutputFormModal';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import WstaPagination from '../shared/WstaPagination';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

export default function OutputConstraintManagement() {
  const d = useOutputManagement();
  const { toast } = useToast();

  function handleSave() {
    const ok = d.handleSave();
    if (ok) toast(d.editingId ? t('output.toast_updated') : t('output.toast_created'), 'success');
  }
  function handleRemove(id: string) { d.removeItem(id); toast(t('output.toast_deleted'), 'success'); }
  function handleBatchRemove() { d.removeMultiple(d.selectedIds); toast(t('output.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { active: 'wsta-badge-dot-green', draft: 'wsta-badge-dot-gray', archived: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { active: 'wsta-dot-green', draft: 'wsta-dot-gray', archived: 'wsta-dot-gray' };
  const statusLabel: Record<string, string> = { active: t('output.status_active'), draft: t('output.status_draft'), archived: t('output.status_archived') };
  const categoryTagClass: Record<string, string> = { '格式约束': 'wsta-tag-indigo', '内容约束': 'wsta-tag-green', '长度约束': 'wsta-tag-amber', '语言约束': 'wsta-tag-green' };

  function makeMenuItems(item: OutputEntry): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('output.edit'), onClick: () => d.openEdit(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('output.delete'), onClick: () => handleRemove(item.id), danger: true },
    ];
  }

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('output.loading')}><TableSkeleton rows={5} cols={5} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('output.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('output.col_name')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar">
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('output.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 120 }} value={d.statusFilter} onChange={(v) => d.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: '已启用' },
            { value: 'draft', label: '草稿' },
            { value: 'archived', label: '已归档' },
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={handleBatchRemove}>{t('output.batch_delete', String(d.selectedIds.size))}</Button>}
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>{t('output.new')}</Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <FileText size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('output.empty_title', '')}</div>
            <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{d.search ? t('output.empty_desc_search') : t('output.empty_desc_general')}</div>
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('output.col_name')}>
            <thead><tr>
              <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('output.select_all')} /></th>
              <th scope="col">{t('output.col_name')}</th>
              <th scope="col">{t('output.col_content')}</th>
              <th scope="col">{t('output.col_category')}</th>
              <th scope="col">{t('output.col_status')}</th>
              <th className="w-[100px] text-right" scope="col">{t('output.col_actions')}</th>
            </tr></thead>
            <tbody>
              {d.paged.map((item) => (
                <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                  <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('output.select_item', item.name)} /></td>
                  <td><span className="font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]">{item.name}</span></td>
                  <td><span className="text-sm text-[var(--color-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.content}>{item.content}</span></td>
                  <td><span className={`wsta-tag-pill ${categoryTagClass[item.category] || 'wsta-tag-indigo'}`}>{item.category}</span></td>
                  <td>
                    <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                      <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                      {statusLabel[item.status] || item.status}
                    </span>
                  </td>
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
        total={d.filtered.length}
        pageSize={7}
        onChange={(p) => d.setPage(p)}
      />

      {d.isFormOpen && <OutputFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSave} onClose={d.closeForm} formErrors={d.formErrors} />}
    </div>
    </ErrorBoundary>
  );
}
