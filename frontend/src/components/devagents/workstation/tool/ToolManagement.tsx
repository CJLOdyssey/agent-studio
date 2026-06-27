import { Search, Plus, MoreHorizontal, Edit3, Copy, History, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Wrench, RefreshCw } from 'lucide-react';
import { useToolData } from './useToolData';
import { useToolUI } from './useToolUI';
import { TOOL_CATEGORIES, TOOL_STATUS_LABEL } from './tool.constants';
import { MOCK_TOOL_VERSIONS } from './mock-data';
import ToolFormModal from './ToolFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import WstaDropdownPortal from '../shared/WstaDropdownPortal';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: string }) {
  if (sortField !== field) return <ArrowUpDown size={12} className="wsta-sort-icon-inactive" />;
  return sortDir === 'asc' ? <ChevronUp size={12} className="wsta-sort-icon-active" /> : <ChevronDown size={12} className="wsta-sort-icon-active" />;
}

export default function ToolManagement() {
  const data = useToolData();
  const ui = useToolUI();
  const { toast } = useToast();

  function handleSave() { ui.save(data); if (!ui.formErrors.length) toast(ui.editingItem ? t('tool.toast_updated') : t('tool.toast_created'), 'success'); }
  function handleDelete() { ui.confirmDelete(data); toast(t('tool.toast_deleted'), 'success'); }
  function handleBatchDelete() { ui.confirmBatchDelete(data); toast(t('tool.toast_batch_deleted'), 'success'); }
  function handleCopy(item: typeof data.processed[0]) { data.copyTool(item); toast(t('tool.toast_copied'), 'success'); }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('tool.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('tool.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('tool.col_name')}>
      {data.error && <div className="wsta-error-banner"><span>{data.error}</span><button onClick={data.retry} aria-label={t('tool.error_retry')}><RefreshCw size={14} /></button><button onClick={data.clearError}><X size={14} /></button></div>}
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('tool.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} aria-label={t('tool.search_placeholder')} />
            {data.search && <button className="wsta-search-clear" onClick={() => data.setSearch('')} aria-label={t('tool.form_cancel')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={data.categoryFilter} onChange={(e) => data.setCategoryFilter(e.target.value)} aria-label={t('tool.col_category')}>
            <option value="all">{t('tool.all_categories')}</option>
            {TOOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && <button className="btn btn-danger" onClick={ui.openBatchDelete} aria-label={t('tool.batch_delete', String(data.selectedIds.size))}><Trash2 size={16} /> {t('tool.batch_delete', String(data.selectedIds.size))}</button>}
          <button className="btn btn-primary" onClick={ui.openCreate} aria-label={t('tool.new')}><Plus size={16} /> {t('tool.new')}</button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Wrench size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('tool.empty_title', data.search ? t('tool.empty_desc_search') : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('tool.empty_desc_search') : t('tool.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('tool.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('tool.select_all')} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('name')} aria-sort={data.sortField === 'name' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('tool.col_name')} <SortIcon field="name" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('category')} aria-sort={data.sortField === 'category' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('tool.col_category')} <SortIcon field="category" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th scope="col">{t('tool.col_desc')}</th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('status')} aria-sort={data.sortField === 'status' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('tool.col_status')} <SortIcon field="status" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th scope="col">{t('tool.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('tool.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('tool.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-tag wsta-tag-team">{item.category}</span></td>
                <td><span className="wsta-text-secondary" style={{ fontSize: 'var(--da-font-size-xs)' }}>{item.description}</span></td>
                <td><span className={`wsta-status wsta-status-${item.status === 'active' ? 'running' : 'stopped'}`}><span className="wsta-status-dot" />{TOOL_STATUS_LABEL[item.status]}</span></td>
                <td><code className="wsta-version">{item.version}</code></td>
                <td className="wsta-col-actions">
                  <div className="wsta-action-group">
                    <button className="wsta-action-btn" onClick={(e) => { ui.setOpenMenuId(ui.openMenuId === item.id ? null : item.id); ui.setMenuAnchorEl(e.currentTarget); }} aria-label={t('tool.more_actions')} aria-expanded={ui.openMenuId === item.id}>
                      <MoreHorizontal size={14} />
                    </button>
                    <WstaDropdownPortal
                      open={ui.openMenuId === item.id}
                      anchorEl={ui.menuAnchorEl}
                      onClose={() => { ui.setOpenMenuId(null); }}
                      items={[
                        { icon: <Edit3 size={14} />, label: t('tool.edit'), onClick: () => ui.openEdit(item) },
                        { icon: <Copy size={14} />, label: t('tool.copy'), onClick: () => handleCopy(item) },
                        { icon: <History size={14} />, label: t('tool.history'), onClick: () => ui.openHistory(item) },
                        { divider: true },
                        { icon: <Trash2 size={14} />, label: t('tool.delete'), onClick: () => ui.openDelete(item), danger: true },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      {data.totalPages > 1 && (
        <div className="wsta-footer">
          <span className="wsta-footer-text">{t('tool.pagination', String(data.processed.length))}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('tool.pagination', String(data.processed.length))}>
            <button className="wsta-page-btn" disabled={data.page <= 1} onClick={() => data.setPage(data.page - 1)} aria-label={t('tool.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === data.page ? 'active' : ''}`} onClick={() => data.setPage(p)} aria-label={t('tool.page_num', String(p))} aria-current={p === data.page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={data.page >= data.totalPages} onClick={() => data.setPage(data.page + 1)} aria-label={t('tool.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {ui.isFormOpen && <ToolFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSave} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && ui.deletingItem && <DeleteConfirmModal name={ui.deletingItem.name} label={t('tool.label')} onConfirm={handleDelete} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label={t('tool.label')} onConfirm={handleBatchDelete} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_TOOL_VERSIONS[ui.historyItem.id] || [{ version: ui.historyItem.version, date: ui.historyItem.createdAt, author: 'admin', changes: '初始创建' }]} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
