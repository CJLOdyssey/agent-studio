import { Search, Plus, MoreHorizontal, Edit3, Copy, History, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import { useSkillData } from './useSkillData';
import { useSkillUI } from './useSkillUI';
import { SKILL_CATEGORIES, SKILL_STATUS_LABEL } from './skill.constants';
import { MOCK_SKILL_VERSIONS } from './mock-data';
import SkillFormModal from './SkillFormModal';
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

export default function SkillManagement() {
  const data = useSkillData();
  const ui = useSkillUI();
  const { toast } = useToast();

  function handleSaveWrapper() { ui.save(data); if (!ui.formErrors.length) toast(ui.editingSkill ? t('skill.toast_updated') : t('skill.toast_created'), 'success'); }
  function handleDeleteWrapper() { ui.confirmDelete(data); toast(t('skill.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { ui.confirmBatchDelete(data); toast(t('skill.toast_batch_deleted', String(data.selectedIds.size)), 'success'); }
  function handleCopyWrapper(item: typeof data.processed[0]) { data.copySkill(item); toast(t('skill.toast_copied'), 'success'); }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('skill.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('skill.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('skill.col_name')}>
      {data.error && <div className="wsta-error-banner"><span>{data.error}</span><button onClick={data.retry} aria-label={t('skill.error_retry')}><RefreshCw size={14} /></button><button onClick={data.clearError}><X size={14} /></button></div>}
      <div className="wsta-toolbar" role="toolbar" aria-label={t('skill.col_name')}>
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" type="text" placeholder={t('skill.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} aria-label={t('skill.search_placeholder')} />
            {data.search && <button className="wsta-search-clear" onClick={() => data.setSearch('')} aria-label={t('skill.search_placeholder')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={data.categoryFilter} onChange={(e) => data.setCategoryFilter(e.target.value)} aria-label={t('skill.all_categories')}>
            <option value="all">{t('skill.all_categories')}</option>
            {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={() => ui.openBatchDelete()} aria-label={t('skill.batch_delete', String(data.selectedIds.size))}>
              <Trash2 size={16} /> {t('skill.batch_delete', String(data.selectedIds.size))}
            </button>
          )}
          <button className="btn btn-primary" onClick={ui.openCreate} aria-label={t('skill.new')}><Plus size={16} /> {t('skill.new')}</button>
        </div>
      </div>

      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Zap size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('skill.empty_title', data.search ? t('skill.empty_desc_search') : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('skill.empty_desc_search') : t('skill.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('skill.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('skill.select_all')} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('name')} aria-sort={data.sortField === 'name' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('skill.col_name')} <SortIcon field="name" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('category')} aria-sort={data.sortField === 'category' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('skill.col_category')} <SortIcon field="category" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('status')} aria-sort={data.sortField === 'status' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('skill.col_status')} <SortIcon field="status" sortField={data.sortField} sortDir={data.sortDir} /></th>
            <th scope="col">{t('skill.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('skill.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('skill.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-tag wsta-tag-team">{item.category}</span></td>
                <td><span className={`wsta-status wsta-status-${item.status === 'installed' ? 'running' : 'stopped'}`}><span className="wsta-status-dot" />{SKILL_STATUS_LABEL[item.status]}</span></td>
                <td><code className="wsta-version">{item.version}</code></td>
                <td className="wsta-col-actions">
                  <div className="wsta-action-group">
                    <button className="wsta-action-btn" onClick={(e) => {
                      ui.setOpenMenuId(ui.openMenuId === item.id ? null : item.id);
                      ui.setMenuAnchorEl(e.currentTarget);
                    }} aria-label={t('skill.more_actions')} aria-expanded={ui.openMenuId === item.id}>
                      <MoreHorizontal size={14} />
                    </button>
                    <WstaDropdownPortal
                      open={ui.openMenuId === item.id}
                      anchorEl={ui.menuAnchorEl}
                      onClose={ui.closeMenu}
                      items={[
                        { icon: <Edit3 size={14} />, label: t('skill.edit'), onClick: () => ui.openEdit(item) },
                        { icon: <Copy size={14} />, label: t('skill.copy'), onClick: () => handleCopyWrapper(item) },
                        { icon: <History size={14} />, label: t('skill.history'), onClick: () => ui.openHistory(item) },
                        { divider: true },
                        { icon: <Trash2 size={14} />, label: t('skill.delete'), onClick: () => ui.openDelete(item), danger: true },
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
          <span className="wsta-footer-text">{t('skill.pagination', String(data.processed.length))}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('skill.pagination', String(data.processed.length))}>
            <button className="wsta-page-btn" disabled={data.page <= 1} onClick={() => data.setPage(data.page - 1)} aria-label={t('skill.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === data.page ? 'active' : ''}`} onClick={() => data.setPage(p)} aria-label={t('skill.page_num', String(p))} aria-current={p === data.page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={data.page >= data.totalPages} onClick={() => data.setPage(data.page + 1)} aria-label={t('skill.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {ui.isFormOpen && <SkillFormModal editingSkill={ui.editingSkill} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSaveWrapper} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && ui.deletingSkill && <DeleteConfirmModal name={ui.deletingSkill.name} label={t('skill.delete')} onConfirm={handleDeleteWrapper} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label={t('skill.delete')} onConfirm={handleBatchDeleteWrapper} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historySkill && <VersionHistoryModal title={ui.historySkill.name} versions={MOCK_SKILL_VERSIONS[ui.historySkill.id] || [{ version: ui.historySkill.version, date: ui.historySkill.createdAt, author: 'admin', changes: t('skill.history') }]} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
