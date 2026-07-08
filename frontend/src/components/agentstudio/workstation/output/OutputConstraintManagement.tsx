import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Trash2, FileText } from 'lucide-react';
import { OUTPUT_CATEGORIES } from './output.constants';
import type { OutputEntry } from './output.types';
import { useOutputData } from './useOutputData';
import { useOutputUI } from './useOutputUI';
import OutputFormModal from './OutputFormModal';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import WstaPagination from '../shared/WstaPagination';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

export default function OutputConstraintManagement() {
  const d = useOutputData();
  const ui = useOutputUI();
  const { toast } = useToast();

  function handleSave() {
    const ok = ui.handleSave({ addItem: d.addItem, updateItem: d.updateItem, editingId: ui.editingId });
    if (ok) toast(ui.editingId ? t('output.toast_updated') : t('output.toast_created'), 'success');
  }
  function handleRemove(id: string) { d.removeItem(id); toast(t('output.toast_deleted'), 'success'); }
  function handleBatchRemove() { d.removeMultiple(d.selectedIds); toast(t('output.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { active: 'wsta-badge-dot-green', draft: 'wsta-badge-dot-gray', archived: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { active: 'wsta-dot-green', draft: 'wsta-dot-gray', archived: 'wsta-dot-gray' };
  const statusLabel: Record<string, string> = { active: '已启用', draft: '草稿', archived: '已归档' };
  const categoryTagClass: Record<string, string> = { '格式约束': 'wsta-tag-indigo', '内容约束': 'wsta-tag-green', '长度约束': 'wsta-tag-amber', '语言约束': 'wsta-tag-green' };

  function makeMenuItems(item: OutputEntry): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('output.edit'), onClick: () => ui.openEdit(item) },
      { key: 'view', icon: <FileText size={14} />, label: t('output.col_name') },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('output.delete'), onClick: () => handleRemove(item.id), danger: true },
    ];
  }

  if (d.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('output.loading')}><TableSkeleton rows={5} cols={5} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('output.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('output.col_name')}>
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('output.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 140 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={[
            { value: 'all', label: t('output.all_categories') },
            ...OUTPUT_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]} />
        </div>
        <div className="wsta-toolbar-right">
          {d.selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={handleBatchRemove}>{t('output.batch_delete', String(d.selectedIds.size))}</Button>}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={ui.openCreate}>{t('output.new')}</Button>
        </div>
      </div>

      <div className="wsta-table-wrap">
        {d.filtered.length === 0 ? (
          <div className="wsta-empty-state">
            <FileText size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('output.empty_title', '')}</div>
            <div className="wsta-empty-state-desc">{d.search ? t('output.empty_desc_search') : t('output.empty_desc_general')}</div>
          </div>
        ) : (
          <table className="wsta-table" role="grid" aria-label={t('output.col_name')}>
            <thead><tr>
              <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('output.select_all')} /></th>
              <th scope="col">{t('output.col_name')}</th>
              <th scope="col">{t('output.col_content')}</th>
              <th scope="col">{t('output.col_category')}</th>
              <th scope="col">{t('output.col_status')}</th>
              <th className="wsta-col-actions" scope="col">{t('output.col_actions')}</th>
            </tr></thead>
            <tbody>
              {d.paged.map((item) => (
                <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                  <td className="wsta-col-checkbox"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('output.select_item', item.name)} /></td>
                  <td><span className="wsta-agent-name">{item.name}</span></td>
                  <td><span className="wsta-secondary-text wsta-truncate" title={item.content}>{item.content}</span></td>
                  <td><span className={`wsta-tag-pill ${categoryTagClass[item.category] || 'wsta-tag-indigo'}`}>{item.category}</span></td>
                  <td>
                    <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                      <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                      {statusLabel[item.status] || item.status}
                    </span>
                  </td>
                  <td className="wsta-col-actions">
                    <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
                      <button className="wsta-action-btn"><MoreHorizontal size={14} /></button>
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
        pageSize={5}
        onChange={(p) => d.setPage(p)}
      />

      {ui.isFormOpen && <OutputFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSave} onClose={ui.closeForm} formErrors={ui.formErrors} />}
    </div>
    </ErrorBoundary>
  );
}
