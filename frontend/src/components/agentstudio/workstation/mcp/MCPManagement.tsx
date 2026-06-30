import { Search, Plus, MoreHorizontal, Edit3, Copy, History, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Server, RefreshCw } from 'lucide-react';
import { useMCPData } from './useMCPData';
import { useMCPUI } from './useMCPUI';
import { MCP_STATUS_LABEL, MCP_TYPE_OPTIONS } from './mcp.constants';
import { MOCK_MCP_VERSIONS } from './mock-data';
import MCPFormModal from './MCPFormModal';
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

export default function MCPManagement() {
  const data = useMCPData();
  const ui = useMCPUI();
  const { toast } = useToast();

  function handleSave() { ui.save(data); if (!ui.formErrors.length) toast(ui.editingItem ? t('mcp.toast_updated') : t('mcp.toast_created'), 'success'); }
  function handleDelete() { ui.confirmDelete(data); toast(t('mcp.toast_deleted'), 'success'); }
  function handleBatchDelete() { ui.confirmBatchDelete(data); toast(t('mcp.toast_batch_deleted', String(data.selectedIds.size)), 'success'); }
  function handleCopy(item: typeof data.processed[0]) { data.copyMCP(item); toast(t('mcp.toast_copied'), 'success'); }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('mcp.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('mcp.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('mcp.col_name')}>
      {data.error && <div className="wsta-error-banner"><span>{data.error}</span><button onClick={data.retry} aria-label={t('mcp.error_retry')}><RefreshCw size={14} /></button><button onClick={data.clearError}><X size={14} /></button></div>}
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('mcp.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} aria-label={t('mcp.search_placeholder')} />
            {data.search && <button className="wsta-search-clear" onClick={() => data.setSearch('')} aria-label={t('mcp.form_cancel')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={data.typeFilter} onChange={(e) => data.setTypeFilter(e.target.value)} aria-label={t('mcp.col_type')}>
            <option value="all">{t('mcp.all_types')}</option>
            {MCP_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && <button className="btn btn-danger" onClick={ui.openBatchDelete} aria-label={t('mcp.batch_delete', String(data.selectedIds.size))}><Trash2 size={16} /> {t('mcp.batch_delete', String(data.selectedIds.size))}</button>}
          <button className="btn btn-primary" onClick={ui.openCreate} aria-label={t('mcp.new')}><Plus size={16} /> {t('mcp.new')}</button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Server size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('mcp.empty_title', data.search ? t('mcp.empty_desc_search') : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('mcp.empty_desc_search') : t('mcp.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('mcp.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('mcp.select_all')} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('name')} aria-sort={data.sortField === 'name' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('mcp.col_name')} <SortIcon field="name" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('type')} aria-sort={data.sortField === 'type' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('mcp.col_type')} <SortIcon field="type" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th scope="col">{t('mcp.col_address')}</th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('status')} aria-sort={data.sortField === 'status' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('mcp.col_status')} <SortIcon field="status" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th scope="col">{t('mcp.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('mcp.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('mcp.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-tag wsta-tag-model">{item.type.toUpperCase()}</span></td>
                <td><code className="wsta-code">{item.command || item.url}</code></td>
                <td><span className={`wsta-status wsta-status-${item.status === 'connected' ? 'running' : 'stopped'}`}><span className="wsta-status-dot" />{MCP_STATUS_LABEL[item.status]}</span></td>
                <td><code className="wsta-version">{item.version}</code></td>
                <td className="wsta-col-actions">
                  <div className="wsta-action-group">
                    <button className="wsta-action-btn" onClick={(e) => { ui.setOpenMenuId(ui.openMenuId === item.id ? null : item.id); ui.setMenuAnchorEl(e.currentTarget); }} aria-label={t('mcp.more_actions')} aria-expanded={ui.openMenuId === item.id}>
                      <MoreHorizontal size={14} />
                    </button>
                    <WstaDropdownPortal
                      open={ui.openMenuId === item.id}
                      anchorEl={ui.menuAnchorEl}
                      onClose={() => { ui.setOpenMenuId(null); }}
                      items={[
                        { icon: <Edit3 size={14} />, label: t('mcp.edit'), onClick: () => ui.openEdit(item) },
                        { icon: <Copy size={14} />, label: t('mcp.copy'), onClick: () => handleCopy(item) },
                        { icon: <History size={14} />, label: t('mcp.history'), onClick: () => ui.openHistory(item) },
                        { divider: true },
                        { icon: <Trash2 size={14} />, label: t('mcp.delete'), onClick: () => ui.openDelete(item), danger: true },
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
          <span className="wsta-footer-text">{t('mcp.pagination', String(data.processed.length))}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('mcp.pagination', String(data.processed.length))}>
            <button className="wsta-page-btn" disabled={data.page <= 1} onClick={() => data.setPage(data.page - 1)} aria-label={t('mcp.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === data.page ? 'active' : ''}`} onClick={() => data.setPage(p)} aria-label={t('mcp.page_num', String(p))} aria-current={p === data.page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={data.page >= data.totalPages} onClick={() => data.setPage(data.page + 1)} aria-label={t('mcp.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {ui.isFormOpen && <MCPFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSave} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && ui.deletingItem && <DeleteConfirmModal name={ui.deletingItem.name} label={t('mcp.form_title_edit')} onConfirm={handleDelete} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label="MCP" onConfirm={handleBatchDelete} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_MCP_VERSIONS[ui.historyItem.id] || [{ version: ui.historyItem.version, date: ui.historyItem.createdAt, author: 'admin', changes: '初始版本' }]} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
