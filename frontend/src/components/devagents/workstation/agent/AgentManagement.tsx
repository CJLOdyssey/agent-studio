import { Search, Plus, MoreHorizontal, Edit3, Copy, History, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Bot, RefreshCw } from 'lucide-react';
import { useAgentManagement } from './useAgentManagement';
import type { SortField } from './agent.types';
import { STATUS_LABEL } from './agent.constants';
import { MOCK_VERSIONS, MOCK_AGENT_PROMPTS } from './mock-data';
import { MOCK_PROMPTS } from '../prompt/mock-data';
import { MOCK_TOOLS } from '../tool/mock-data';
import { MOCK_MCPS } from '../mcp/mock-data';
import { MOCK_SKILLS } from '../skill/mock-data';
import AgentFormModal from './AgentFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import WstaDropdownPortal from '../shared/WstaDropdownPortal';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

const ALL_PROMPTS = [...MOCK_AGENT_PROMPTS, ...MOCK_PROMPTS];

export default function AgentManagement() {
  const mgmt = useAgentManagement();
  const { toast } = useToast();

  function getPromptName(id: string): string { const p = ALL_PROMPTS.find((p) => p.id === id); return p ? p.name : '-'; }

  function handleSaveWrapper() { mgmt.handleSave(); if (mgmt.formErrors.length === 0) toast(mgmt.editingAgent ? t('agent.toast_updated') : t('agent.toast_created'), 'success'); }
  function handleDeleteWrapper() { mgmt.handleDelete(); toast(t('agent.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { mgmt.handleBatchDelete(); toast(t('agent.toast_batch_deleted', String(mgmt.selectedIds.size)), 'success'); }
  function handleCopyWrapper(item: typeof mgmt.processed[0]) { mgmt.handleCopy(item); toast(t('agent.toast_copied'), 'success'); }

  const statusColors: Record<string, string> = { running: 'wsta-badge-green', stopped: 'wsta-badge-gray', error: 'wsta-badge-red' };

  const SortIcon = ({ field }: { field: 'name' | 'team' | 'status' }) => {
    if (mgmt.sortField !== field) return <ArrowUpDown size={12} className="wsta-sort-icon-inactive" />;
    return mgmt.sortDir === 'asc' ? <ChevronUp size={12} className="wsta-sort-icon-active" /> : <ChevronDown size={12} className="wsta-sort-icon-active" />;
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th className="wsta-th wsta-sortable" scope="col" onClick={() => mgmt.handleSort(field)} aria-sort={mgmt.sortField === field ? (mgmt.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{label} <SortIcon field={field} /></th>
  );

  if (mgmt.isLoading) return <div className="wsta-panel" role="region" aria-label={t('agent.loading')}><TableSkeleton rows={5} cols={7} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-panel wsta-error-state" role="alert"><p>{t('agent.error_render')}</p></div>}>
    <div className="wsta-panel" role="region" aria-label="Agent 管理">
      {mgmt.error && <div className="wsta-error-banner"><span>{mgmt.error}</span><button onClick={mgmt.retry} aria-label={t('agent.error_retry')}><RefreshCw size={14} /></button><button onClick={mgmt.clearError}><X size={14} /></button></div>}
      {mgmt.batchError && <div className="wsta-error-banner" role="alert"><span>{mgmt.batchError}</span></div>}

      <div className="wsta-toolbar" role="toolbar" aria-label={t('agent.col_name')}>
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('agent.search_placeholder')} value={mgmt.search} onChange={(e) => mgmt.setSearch(e.target.value)} aria-label={t('agent.search_placeholder')} />
            {mgmt.search && <button className="wsta-search-clear" onClick={() => mgmt.setSearch('')} aria-label={t('agent.search_placeholder')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={mgmt.statusFilter} onChange={(e) => mgmt.setStatusFilter(e.target.value as 'all' | 'running' | 'stopped' | 'error')} aria-label={t('agent.col_status')}>
            <option value="all">全部状态</option>
            <option value="running">运行中</option>
            <option value="stopped">已停止</option>
            <option value="error">异常</option>
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {mgmt.selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={mgmt.openBatchDelete} aria-label={t('agent.batch_delete', String(mgmt.selectedIds.size))}>
              <Trash2 size={16} /> {t('agent.batch_delete', String(mgmt.selectedIds.size))}
            </button>
          )}
          <button className="btn btn-primary" onClick={mgmt.openCreate} aria-label={t('agent.new')}><Plus size={16} /> {t('agent.new')}</button>
        </div>
      </div>

      <div className="wsta-table-wrap">
        {mgmt.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Bot size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('agent.empty_title', mgmt.search ? '' : '')}</div>
            <div className="wsta-empty-state-desc">{mgmt.search ? t('agent.empty_desc_search') : t('agent.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('agent.col_name')}>
          <thead><tr>
            <th className="wsta-th wsta-th-check" scope="col"><input type="checkbox" checked={mgmt.allOnPageSelected} onChange={mgmt.toggleSelectAll} aria-label={t('agent.select_all')} /></th>
            <SortHeader field="name" label={t('agent.col_name')} />
            <SortHeader field="team" label={t('agent.col_team')} />
            <th className="wsta-th" scope="col">{t('agent.col_model')}</th>
            <th className="wsta-th" scope="col">提示词</th>
            <SortHeader field="status" label={t('agent.col_status')} />
            <th className="wsta-th" scope="col">{t('agent.col.version')}</th>
            <th className="wsta-th wsta-th-actions" scope="col">{t('agent.col_actions')}</th>
          </tr></thead>
          <tbody>
            {mgmt.paged.map((agent) => (
              <tr key={agent.id} className={mgmt.selectedIds.has(agent.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-td wsta-td-check"><input type="checkbox" checked={mgmt.selectedIds.has(agent.id)} onChange={() => mgmt.toggleSelect(agent.id)} aria-label={t('agent.select_item', agent.name)} /></td>
                <td className="wsta-td"><span className="wsta-name-link">{agent.name}</span></td>
                <td className="wsta-td">{agent.team}</td>
                <td className="wsta-td"><code className="wsta-code">{agent.model}</code></td>
                <td className="wsta-td"><span className="wsta-prompt-name">{getPromptName(agent.systemPromptId)}</span></td>
                <td className="wsta-td"><span className={`wsta-badge ${statusColors[agent.status]}`}>{STATUS_LABEL[agent.status]}</span></td>
                <td className="wsta-td"><code className="wsta-code">{agent.version}</code></td>
                <td className="wsta-td wsta-td-actions">
                  <div className="wsta-action-group">
                    <button className="wsta-action-btn" onClick={(e) => { mgmt.setOpenMenuId(mgmt.openMenuId === agent.id ? null : agent.id); mgmt.setMenuAnchorEl(e.currentTarget); }} aria-label={t('agent.more_actions')} aria-expanded={mgmt.openMenuId === agent.id}><MoreHorizontal size={14} /></button>
                    <WstaDropdownPortal open={mgmt.openMenuId === agent.id} anchorEl={mgmt.menuAnchorEl} onClose={mgmt.closeMenu} items={[
                      { icon: <Edit3 size={14} />, label: t('agent.edit'), onClick: () => mgmt.openEdit(agent) },
                      { icon: <Copy size={14} />, label: t('agent.copy'), onClick: () => handleCopyWrapper(agent) },
                      { icon: <History size={14} />, label: t('agent.history'), onClick: () => mgmt.openHistory(agent) },
                      { divider: true },
                      { icon: <Trash2 size={14} />, label: t('agent.delete'), onClick: () => mgmt.openDelete(agent), danger: true },
                    ]} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {mgmt.totalPages > 1 && (
        <div className="wsta-footer">
          <span className="wsta-footer-text">{t('agent.pagination', String(mgmt.processed.length))}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('agent.pagination', String(mgmt.processed.length))}>
            <button className="wsta-page-btn" disabled={mgmt.page <= 1} onClick={() => mgmt.setPage(mgmt.page - 1)} aria-label={t('agent.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: mgmt.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === mgmt.page ? 'active' : ''}`} onClick={() => mgmt.setPage(p)} aria-label={t('agent.page_num', String(p))} aria-current={p === mgmt.page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={mgmt.page >= mgmt.totalPages} onClick={() => mgmt.setPage(mgmt.page + 1)} aria-label={t('agent.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {mgmt.isFormOpen && <AgentFormModal editingAgent={mgmt.editingAgent} formData={mgmt.formData} setFormData={mgmt.setFormData} formErrors={mgmt.formErrors} onSave={handleSaveWrapper} onClose={() => mgmt.setIsFormOpen(false)} availablePrompts={ALL_PROMPTS} availableTools={MOCK_TOOLS} availableMCPs={MOCK_MCPS} availableSkills={MOCK_SKILLS} />}
      {mgmt.isDeleteOpen && mgmt.deletingAgent && <DeleteConfirmModal name={mgmt.deletingAgent.name} label="Agent" onConfirm={handleDeleteWrapper} onClose={() => mgmt.setIsDeleteOpen(false)} />}
      {mgmt.isBatchDeleteOpen && <BatchDeleteModal count={mgmt.selectedIds.size} label="Agent" onConfirm={handleBatchDeleteWrapper} onClose={() => mgmt.setIsBatchDeleteOpen(false)} />}
      {mgmt.isHistoryOpen && mgmt.historyAgent && <VersionHistoryModal title={mgmt.historyAgent.name} versions={MOCK_VERSIONS[mgmt.historyAgent.id] || [{ version: mgmt.historyAgent.version, date: mgmt.historyAgent.createdAt, author: 'admin', changes: '- 初始创建' }]} onClose={() => mgmt.setIsHistoryOpen(false)} />}
    </div>
    </ErrorBoundary>
  );
}
