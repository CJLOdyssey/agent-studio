import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Server } from 'lucide-react';
import { useMCPData } from './useMCPData';
import { useMCPUI } from './useMCPUI';
import { MCP_STATUS_LABEL } from './mcp.constants';
import { MOCK_MCP_VERSIONS } from './mock-data';
import MCPFormModal from './MCPFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import WstaPagination from '../shared/WstaPagination';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

export default function MCPManagement() {
  const data = useMCPData();
  const ui = useMCPUI();
  const { toast } = useToast();

  function handleSave() { ui.save(data); if (!ui.formErrors.length) toast(ui.editingItem ? t('mcp.toast_updated') : t('mcp.toast_created'), 'success'); }
  function handleDelete() { ui.confirmDelete(data); toast(t('mcp.toast_deleted'), 'success'); }
  function handleBatchDelete() { ui.confirmBatchDelete(data); toast(t('mcp.toast_batch_deleted', String(data.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { connected: 'wsta-badge-dot-green', disconnected: 'wsta-badge-dot-gray', error: 'wsta-badge-dot-red' };
  const dotClass: Record<string, string> = { connected: 'wsta-dot-green', disconnected: 'wsta-dot-gray', error: 'wsta-dot-red' };

  function makeMenuItems(item: typeof data.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('mcp.edit'), onClick: () => ui.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('mcp.col_name') },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('mcp.delete'), onClick: () => ui.openDelete(item), danger: true },
    ];
  }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('mcp.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('mcp.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('mcp.col_name')}>
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('mcp.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={data.statusFilter} onChange={(v) => data.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'connected', label: MCP_STATUS_LABEL.connected },
            { value: 'disconnected', label: MCP_STATUS_LABEL.disconnected },
            { value: 'error', label: MCP_STATUS_LABEL.error },
          ]} />
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={ui.openBatchDelete}>{t('mcp.batch_delete', String(data.selectedIds.size))}</Button>}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={ui.openCreate}>{t('mcp.new')}</Button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Server size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('mcp.empty_title', data.search ? '' : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('mcp.empty_desc_search') : t('mcp.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('mcp.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('mcp.select_all')} /></th>
            <th scope="col">{t('mcp.col_name')}</th>
            <th scope="col">{t('mcp.col_address')}</th>
            <th scope="col">工具数</th>
            <th scope="col">{t('mcp.col_status')}</th>
            <th className="wsta-col-actions" scope="col">{t('mcp.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('mcp.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-mono-text">{item.url || item.command}</span></td>
                <td><span className="wsta-tag-pill wsta-tag-indigo">{(item.id.charCodeAt(1) % 10) + 1}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {MCP_STATUS_LABEL[item.status]}
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
        current={data.page}
        total={data.processed.length}
        pageSize={5}
        onChange={(p) => data.setPage(p)}
      />

      {ui.isFormOpen && <MCPFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSave} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && <DeleteConfirmModal name={ui.deletingItem?.name || ''} label="MCP" onConfirm={handleDelete} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label="MCP" onConfirm={handleBatchDelete} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_MCP_VERSIONS[ui.historyItem.id] || []} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
