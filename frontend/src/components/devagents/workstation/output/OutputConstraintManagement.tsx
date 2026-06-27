import { Search, Plus, MoreHorizontal, Edit3, Copy, Trash2, X, ChevronLeft, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { OUTPUT_STATUS_LABEL, OUTPUT_CATEGORIES } from './output.constants';
import type { OutputEntry } from './output.types';
import { useOutputData } from './useOutputData';
import { useOutputUI } from './useOutputUI';
import OutputFormModal from './OutputFormModal';
import WstaDropdownPortal from '../shared/WstaDropdownPortal';
import type { MenuItemConfig } from '../shared/WstaDropdownPortal';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { TableSkeleton } from '../shared/LoadingSkeleton';
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
  function handleCopy(item: OutputEntry) { d.copyItem(item); toast(t('output.toast_copied'), 'success'); }
  function handleRemove(id: string) { d.removeItem(id); toast(t('output.toast_deleted'), 'success'); }
  function handleBatchRemove() {
    d.removeMultiple(d.selectedIds);
    toast(t('output.toast_batch_deleted', String(d.selectedIds.size)), 'success');
  }

  if (d.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('output.loading')}><TableSkeleton rows={5} cols={5} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('output.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('output.col_name')}>
      {d.error && <div className="wsta-error-banner"><span>{d.error}</span><button onClick={d.retry} aria-label={t('output.error_retry')}><RefreshCw size={14} /></button><button onClick={d.clearError}><X size={14} /></button></div>}
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('output.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} aria-label={t('output.search_placeholder')} />
            {d.search && <button className="wsta-search-clear" onClick={() => d.setSearch('')} aria-label={t('output.form_cancel')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={d.categoryFilter} onChange={(e) => d.setCategoryFilter(e.target.value)} aria-label={t('output.col_category')}>
            <option value="all">{t('output.all_categories')}</option>
            {OUTPUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {d.selectedIds.size > 0 && <button className="btn btn-danger" onClick={handleBatchRemove} aria-label={t('output.batch_delete', String(d.selectedIds.size))}><Trash2 size={16} /> {t('output.batch_delete', String(d.selectedIds.size))}</button>}
          <button className="btn btn-primary" onClick={ui.openCreate} aria-label={t('output.new')}><Plus size={16} /> {t('output.new')}</button>
        </div>
      </div>

      <div className="wsta-table-wrap">
        {d.filtered.length === 0 ? (
          <div className="wsta-empty-state">
            <FileText size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('output.empty_title', d.search ? t('output.empty_desc_search') : '')}</div>
            <div className="wsta-empty-state-desc">{d.search ? t('output.empty_desc_search') : t('output.empty_desc_general')}</div>
          </div>
        ) : (
          <table className="wsta-table" role="grid" aria-label={t('output.col_name')} style={{ flex: 'none' }}>
            <thead>
              <tr>
                <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('output.select_all')} /></th>
                <th scope="col">{t('output.col_name')}</th>
                <th scope="col">{t('output.col_content')}</th>
                <th scope="col">{t('output.col_category')}</th>
                <th scope="col">{t('output.col_status')}</th>
                <th className="wsta-col-actions" scope="col">{t('output.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {d.paged.map((item) => (
                <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                  <td className="wsta-col-checkbox"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('output.select_item', item.name)} /></td>
                  <td className="wsta-cell-name">{item.name}</td>
                  <td className="wsta-cell-content"><span className="wsta-content-preview">{item.content}</span></td>
                  <td>{item.category}</td>
                  <td><span className={`wsta-status-tag wsta-status-${item.status}`}>{OUTPUT_STATUS_LABEL[item.status]}</span></td>
                  <td className="wsta-col-actions">
                    <button className="wsta-action-btn" onClick={(e) => { ui.setOpenMenuId(ui.openMenuId === item.id ? null : item.id); ui.setMenuAnchorEl(e.currentTarget); }} aria-label={t('output.more_actions')}>
                      <MoreHorizontal size={16} />
                    </button>
                    <WstaDropdownPortal
                      open={ui.openMenuId === item.id}
                      anchorEl={ui.menuAnchorEl}
                      items={(() => {
                        const menuItems: MenuItemConfig[] = [
                          { icon: <Edit3 size={14} />, label: t('output.edit'), onClick: () => ui.openEdit(item) },
                          { icon: <Copy size={14} />, label: t('output.copy'), onClick: () => handleCopy(item) },
                          { divider: true },
                          { icon: <Trash2 size={14} />, label: t('output.delete'), onClick: () => handleRemove(item.id), danger: true },
                        ];
                        return menuItems;
                      })()}
                      onClose={() => ui.setOpenMenuId(null)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {d.totalPages > 1 && (
        <div className="wsta-pagination" role="navigation" aria-label={t('output.pagination', String(d.totalPages))}>
          <span className="wsta-page-info">{t('output.pagination', String(d.filtered.length))}</span>
          <div className="wsta-page-btns">
            <button className="wsta-page-btn" disabled={d.page <= 1} onClick={() => d.setPage(d.page - 1)} aria-label={t('output.page_prev')}><ChevronLeft size={16} /></button>
            <span className="wsta-page-num">{t('output.page_num', String(d.page))}</span>
            <button className="wsta-page-btn" disabled={d.page >= d.totalPages} onClick={() => d.setPage(d.page + 1)} aria-label={t('output.page_next')}><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {ui.isFormOpen && <OutputFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSave} onClose={ui.closeForm} formErrors={ui.formErrors} />}
    </div>
    </ErrorBoundary>
  );
}
