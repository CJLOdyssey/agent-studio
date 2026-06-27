import { useEffect, useRef } from 'react';
import { Search, Plus, MoreHorizontal, Edit3, Copy, History, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, MessageSquare, FileText, Upload, Download, AlertTriangle } from 'lucide-react';
import { usePromptData, usePromptUI, usePromptImportExport, PROMPT_STATUS_LABEL, PROMPT_CATEGORIES, MOCK_PROMPT_VERSIONS, t } from './index';
import type { CategoryFilter } from './index';
import PromptFormModal from './PromptFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import WstaDropdownPortal from '../shared/WstaDropdownPortal';
import { useToast } from '../../../../utils/useToast';

export default function PromptManagement() {
  const data = usePromptData();
  const ui = usePromptUI();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { exportPrompts, importPrompts } = usePromptImportExport(
    data.getAllItems,
    data.addItems,
  );

  useEffect(() => {
    if (data.error) {
      toast(data.error, 'error');
      data.clearError();
    }
  }, [data.error]);

  function handleExport() {
    exportPrompts();
    toast(t('prompt.toast_exported'), 'success');
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const result = importPrompts(parsed);
        toast(result.message, result.success ? 'success' : 'error');
      } catch {
        toast(t('prompt.toast_import_fail'), 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const SortIcon = ({ field }: { field: 'name' | 'category' | 'status' }) => {
    if (data.sortField !== field) return <ArrowUpDown size={12} className="wsta-sort-icon-inactive" />;
    return data.sortDir === 'asc' ? <ChevronUp size={12} className="wsta-sort-icon-active" /> : <ChevronDown size={12} className="wsta-sort-icon-active" />;
  };

  function handleSaveWrapper() {
    ui.save(data);
    if (ui.formErrors.length === 0) {
      toast(ui.editingItem ? t('prompt.toast_updated') : t('prompt.toast_created'), 'success');
    }
  }

  function handleDeleteWrapper() {
    ui.confirmDelete(data);
    toast(t('prompt.toast_deleted'), 'success');
  }

  function handleBatchDeleteWrapper() {
    ui.confirmBatchDelete(data);
    toast(t('prompt.toast_batch_deleted'), 'success');
  }

  function handleCopyWrapper(item: typeof data.processed[0]) {
    data.copyPrompt(item);
    toast(t('prompt.toast_copied'), 'success');
  }

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('prompt.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label="提示词管理">
      {data.error && (
        <div className="wsta-error-banner" role="alert">
          <AlertTriangle size={16} />
          <span>{data.error}</span>
          <button className="wsta-error-banner-close" onClick={data.clearError} aria-label="关闭错误提示"><X size={14} /></button>
        </div>
      )}
      <div className="wsta-toolbar" role="toolbar" aria-label="操作工具栏">
        <div className="wsta-toolbar-left">
          <button className="btn btn-outline" onClick={handleImportClick} aria-label={t('prompt.import')}><Upload size={16} /> {t('prompt.import')}</button>
          <button className="btn btn-outline" onClick={handleExport} aria-label={t('prompt.export')}><Download size={16} /> {t('prompt.export')}</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} aria-hidden="true" />
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('prompt.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} aria-label={t('prompt.search_placeholder')} />
            {data.search && <button className="wsta-search-clear" onClick={() => data.setSearch('')} aria-label="清除搜索"><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={data.categoryFilter} onChange={(e) => data.setCategoryFilter(e.target.value as CategoryFilter)} aria-label="按分类筛选">
            <option value="all">{t('prompt.all_categories')}</option>
            {PROMPT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={() => ui.openBatchDelete()} aria-label={t('prompt.batch_delete', { n: data.selectedIds.size })}>
              <Trash2 size={16} /> {t('prompt.batch_delete', { n: data.selectedIds.size })}
            </button>
          )}
          <button className="btn btn-primary" onClick={ui.openCreate} aria-label={t('prompt.new')}><Plus size={16} /> {t('prompt.new')}</button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {data.isLoading ? (
          <TableSkeleton rows={5} cols={6} aria-label={t('prompt.loading')} />
        ) : data.error ? null : data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <FileText size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('prompt.empty_title', { extra: data.search ? '匹配结果' : '数据' })}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('prompt.empty_desc_search') : t('prompt.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label="提示词列表">
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('prompt.select_all')} /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('name')} aria-sort={data.sortField === 'name' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('prompt.col_name')} <SortIcon field="name" /></th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('category')} aria-sort={data.sortField === 'category' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('prompt.col_category')} <SortIcon field="category" /></th>
            <th scope="col">{t('prompt.col_model')}</th>
            <th className="wsta-sortable" scope="col" onClick={() => data.handleSort('status')} aria-sort={data.sortField === 'status' ? (data.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{t('prompt.col_status')} <SortIcon field="status" /></th>
            <th scope="col">{t('prompt.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('prompt.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.length === 0 ? (
              <tr><td colSpan={7} className="wsta-empty-cell"><MessageSquare size={24} /><span>{t('prompt.empty_cell')}</span></td></tr>
            ) : data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('prompt.select_item', { name: item.name })} /></td>
                <td><span className="wsta-agent-name" title={item.content.slice(0, 80)}>{item.name}</span></td>
                <td><span className="wsta-tag wsta-tag-team">{item.category}</span></td>
                <td><span className="wsta-tag wsta-tag-model">{item.model}</span></td>
                <td><span className={`wsta-status wsta-status-${item.status === 'active' ? 'running' : item.status === 'draft' ? 'stopped' : 'error'}`}><span className="wsta-status-dot" />{PROMPT_STATUS_LABEL[item.status]}</span></td>
                <td><code className="wsta-version">{item.version}</code></td>
                <td className="wsta-col-actions">
                  <div className="wsta-action-group">
                    <button className="wsta-action-btn" onClick={(e) => {
                      const nextId = ui.openMenuId === item.id ? null : item.id;
                      ui.setOpenMenuId(nextId);
                      ui.setMenuAnchorEl(nextId ? e.currentTarget : null);
                    }} aria-label={t('prompt.more_actions')} aria-expanded={ui.openMenuId === item.id}>
                      <MoreHorizontal size={14} />
                    </button>
                    <WstaDropdownPortal
                      open={ui.openMenuId === item.id}
                      anchorEl={ui.menuAnchorEl}
                      onClose={ui.closeMenu}
                      items={[
                        { icon: <Edit3 size={14} />, label: t('prompt.edit'), onClick: () => ui.openEdit(item) },
                        { icon: <Copy size={14} />, label: t('prompt.copy'), onClick: () => handleCopyWrapper(item) },
                        { icon: <History size={14} />, label: t('prompt.history'), onClick: () => ui.openHistory(item) },
                        { divider: true },
                        { icon: <Trash2 size={14} />, label: t('prompt.delete'), onClick: () => ui.openDelete(item), danger: true },
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
          <span className="wsta-footer-text">{t('prompt.pagination', { n: data.processed.length })}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('prompt.pagination', { n: data.processed.length })}>
            <button className="wsta-page-btn" disabled={data.page <= 1} onClick={() => data.setPage(data.page - 1)} aria-label={t('prompt.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === data.page ? 'active' : ''}`} onClick={() => data.setPage(p)} aria-label={t('prompt.page_num', { n: p })} aria-current={p === data.page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={data.page >= data.totalPages} onClick={() => data.setPage(data.page + 1)} aria-label={t('prompt.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {ui.isFormOpen && <PromptFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSaveWrapper} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && ui.deletingItem && <DeleteConfirmModal name={ui.deletingItem.name} label="提示词" onConfirm={handleDeleteWrapper} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label="提示词" onConfirm={handleBatchDeleteWrapper} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_PROMPT_VERSIONS[ui.historyItem.id] || [{ version: ui.historyItem.version, date: ui.historyItem.createdAt, author: 'admin', changes: '初始创建' }]} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
