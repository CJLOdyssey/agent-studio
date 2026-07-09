import { useState } from 'react';
import { Search, Plus, MoreHorizontal, Edit3, Copy, History, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users, Bot, RefreshCw } from 'lucide-react';
import { useTeamData } from './useTeamData';
import { useTeamUI } from './useTeamUI';
import { TEAM_STATUS_LABEL } from './team.constants';
import { MOCK_TEAM_VERSIONS } from './mock-data';
import TeamFormModal from './TeamFormModal';
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

export default function TeamManagement() {
  const data = useTeamData();
  const ui = useTeamUI();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSaveWrapper() { ui.save(data); if (ui.formErrors.length === 0) toast(ui.editingItem ? t('team.toast_updated') : t('team.toast_created'), 'success'); }
  function handleDeleteWrapper() { ui.confirmDelete(data); toast(t('team.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { ui.confirmBatchDelete(data); toast(t('team.toast_batch_deleted', String(data.selectedIds.size)), 'success'); }
  function handleCopyWrapper(item: typeof data.processed[0]) { data.copyTeam(item); toast(t('team.toast_copied'), 'success'); }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('team.loading')}><TableSkeleton rows={5} cols={5} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('team.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('team.col_name')}>
      {data.error && <div className="wsta-error-banner"><span>{data.error}</span><button onClick={data.retry} aria-label={t('team.error_retry')}><RefreshCw size={14} /></button><button onClick={data.clearError}><X size={14} /></button></div>}
      <div className="wsta-toolbar" role="toolbar" aria-label={t('team.col_name')}>
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('team.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} aria-label={t('team.search_placeholder')} />
            {data.search && <button className="wsta-search-clear" onClick={() => data.setSearch('')} aria-label={t('team.search_placeholder')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={data.statusFilter} onChange={(e) => data.setStatusFilter(e.target.value as typeof data.statusFilter)} aria-label={t('team.col_status')}>
            <option value="all">{t('team.all_status')}</option>
            <option value="active">{t('team.status_active')}</option>
            <option value="inactive">{t('team.status_inactive')}</option>
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={() => ui.openBatchDelete()} aria-label={t('team.batch_delete', String(data.selectedIds.size))}>
              <Trash2 size={16} /> {t('team.batch_delete', String(data.selectedIds.size))}
            </button>
          )}
          <button className="btn btn-primary" onClick={ui.openCreate} aria-label={t('team.new')}><Plus size={16} /> {t('team.new')}</button>
        </div>
      </div>

      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Users size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('team.empty_title', data.search ? '' : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('team.empty_desc_search') : t('team.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('team.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('team.select_all')} /></th>
            <th className="wsta-col-expand" scope="col"></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('name')} aria-sort={data.sortField === 'name' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('team.col_name')} <SortIcon field="name" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th scope="col">{t('team.col_members')}</th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('status')} aria-sort={data.sortField === 'status' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('team.col_status')} <SortIcon field="status" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th className="wsta-col-actions" scope="col">{t('team.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <>
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('team.select_item', item.name)} /></td>
                <td className="wsta-col-expand">
                  <button className="wsta-expand-btn" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} aria-label={expandedId === item.id ? '收起成员' : '展开成员'}>
                    {expandedId === item.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-member-count">{item.memberCount}</span></td>
                <td><span className={`wsta-badge ${item.status === 'active' ? 'wsta-badge-green' : 'wsta-badge-gray'}`}>{TEAM_STATUS_LABEL[item.status]}</span></td>
                <td className="wsta-col-actions">
                  <div className="wsta-action-group">
                    <button className="wsta-action-btn" onClick={(e) => { ui.setOpenMenuId(ui.openMenuId === item.id ? null : item.id); ui.setMenuAnchorEl(e.currentTarget); }} aria-label={t('team.more_actions')} aria-expanded={ui.openMenuId === item.id}>
                      <MoreHorizontal size={14} />
                    </button>
                    <WstaDropdownPortal open={ui.openMenuId === item.id} anchorEl={ui.menuAnchorEl} onClose={ui.closeMenu} items={[
                      { icon: <Edit3 size={14} />, label: t('team.edit'), onClick: () => ui.openEdit(item) },
                      { icon: <Copy size={14} />, label: t('team.copy'), onClick: () => handleCopyWrapper(item) },
                      { icon: <History size={14} />, label: t('team.history'), onClick: () => ui.openHistory(item) },
                      { divider: true },
                      { icon: <Trash2 size={14} />, label: t('team.delete'), onClick: () => ui.openDelete(item), danger: true },
                    ]} />
                  </div>
                </td>
              </tr>
              {expandedId === item.id && (
                <tr key={`${item.id}-members`} className="wsta-expanded-row">
                  <td colSpan={6}>
                    {item.agents.length === 0 ? (
                      <div className="wsta-empty-members">暂无团队成员</div>
                    ) : (
                      <table className="wsta-sub-table">
                        <thead>
                          <tr>
                            <th>名称</th>
                            <th>角色</th>
                            <th>关联配置</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.agents.map((member) => (
                            <tr key={member.id}>
                              <td><Bot size={14} className="wsta-member-icon" /> {member.name}</td>
                              <td>{member.role}</td>
                              <td>{member.agentConfigId ? <span className="wsta-badge wsta-badge-blue">已关联</span> : <span className="wsta-badge wsta-badge-gray">独立成员</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
              </>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {data.totalPages > 1 && (
        <div className="wsta-footer">
          <span className="wsta-footer-text">{t('team.pagination', String(data.processed.length))}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('team.pagination', String(data.processed.length))}>
            <button className="wsta-page-btn" disabled={data.page <= 1} onClick={() => data.setPage(data.page - 1)} aria-label={t('team.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === data.page ? 'active' : ''}`} onClick={() => data.setPage(p)} aria-label={t('team.page_num', String(p))} aria-current={p === data.page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={data.page >= data.totalPages} onClick={() => data.setPage(data.page + 1)} aria-label={t('team.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {ui.isFormOpen && <TeamFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSaveWrapper} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && ui.deletingItem && <DeleteConfirmModal name={ui.deletingItem.name} label={t('team.delete')} onConfirm={handleDeleteWrapper} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label={t('team.delete')} onConfirm={handleBatchDeleteWrapper} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_TEAM_VERSIONS[ui.historyItem.id] || [{ version: '-', date: ui.historyItem.createdAt, author: 'admin', changes: '- 初始创建' }]} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
