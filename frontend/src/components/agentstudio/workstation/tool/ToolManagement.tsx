import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Wrench, Play } from 'lucide-react';
import { useToolData } from './useToolData';
import { useToolUI } from './useToolUI';
import { TOOL_CATEGORIES, TOOL_STATUS_LABEL } from './tool.constants';
import { MOCK_TOOL_VERSIONS } from './mock-data';
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
  const data = useToolData();
  const ui = useToolUI();
  const { toast } = useToast();

  function handleSave() { ui.save(data); if (!ui.formErrors.length) toast(ui.editingItem ? t('tool.toast_updated') : t('tool.toast_created'), 'success'); }
  function handleDelete() { ui.confirmDelete(data); toast(t('tool.toast_deleted'), 'success'); }
  function handleBatchDelete() { ui.confirmBatchDelete(data); toast(t('tool.toast_batch_deleted'), 'success'); }

  const statusDotClass: Record<string, string> = { active: 'wsta-badge-dot-green', disabled: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { active: 'wsta-dot-green', disabled: 'wsta-dot-gray' };

  function makeMenuItems(item: typeof data.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('tool.edit'), onClick: () => ui.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('tool.col_name') },
      { key: 'test', icon: <Play size={14} />, label: t('tool.col_name') },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('tool.delete'), onClick: () => ui.openDelete(item), danger: true },
    ];
  }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('tool.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('tool.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('tool.col_name')}>
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('tool.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={data.categoryFilter} onChange={(v) => data.setCategoryFilter(v)} options={[
            { value: 'all', label: t('tool.all_categories') },
            ...TOOL_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]} />
          <Select style={{ width: 120 }} value={data.statusFilter} onChange={(v) => data.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'active', label: TOOL_STATUS_LABEL.active },
            { value: 'disabled', label: TOOL_STATUS_LABEL.disabled },
          ]} />
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={ui.openBatchDelete}>{t('tool.batch_delete', String(data.selectedIds.size))}</Button>}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={ui.openCreate}>{t('tool.new')}</Button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Wrench size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('tool.empty_title', data.search ? '' : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('tool.empty_desc_search') : t('tool.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('tool.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('tool.select_all')} /></th>
            <th scope="col">{t('tool.col_name')}</th>
            <th scope="col">{t('tool.col_category')}</th>
            <th scope="col">{t('tool.col_desc')}</th>
            <th scope="col">{t('tool.col_status')}</th>
            <th scope="col">{t('tool.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('tool.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('tool.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-tag-pill wsta-tag-indigo">{item.category}</span></td>
                <td><span className="wsta-secondary-text wsta-truncate" title={item.description}>{item.description}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {TOOL_STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td><span className="wsta-mono-text">{item.version}</span></td>
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
        current={data.page}
        total={data.processed.length}
        pageSize={5}
        onChange={(p) => data.setPage(p)}
      />

      {ui.isFormOpen && <ToolFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSave} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && <DeleteConfirmModal name={ui.deletingItem?.name || ''} label="工具" onConfirm={handleDelete} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label="工具" onConfirm={handleBatchDelete} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_TOOL_VERSIONS[ui.historyItem.id] || []} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
