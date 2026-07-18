import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Play, Trash2, Server } from 'lucide-react';
import { useState } from 'react';
import { useMCPData } from './useMCPData';
import { MCP_STATUS_LABEL } from './mcp.constants';
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
  const d = useMCPData();
  const { toast } = useToast();
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleTestMCP(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/mcps/${id}/test`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        toast(`❌ ${body.detail || '测试请求失败'}`, 'error');
      } else {
        const msg = body.message || '无返回信息';
        toast(body.success ? `✅ ${msg} (${body.duration_ms ?? 0}ms)` : `❌ ${msg}`, body.success ? 'success' : 'error');
      }
    } catch {
      toast('❌ 测试请求失败', 'error');
    } finally {
      setTestingId(null);
    }
  }

  function handleSave() { d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('mcp.toast_updated') : t('mcp.toast_created'), 'success'); }
  function handleDelete() { d.handleDelete(); toast(t('mcp.toast_deleted'), 'success'); }
  function handleBatchDelete() { d.handleBatchDelete(); toast(t('mcp.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { connected: 'wsta-badge-dot-green', disconnected: 'wsta-badge-dot-gray', error: 'wsta-badge-dot-red' };
  const dotClass: Record<string, string> = { connected: 'wsta-dot-green', disconnected: 'wsta-dot-gray', error: 'wsta-dot-red' };

  function makeMenuItems(item: typeof d.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('mcp.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('mcp.history'), onClick: () => d.openHistory(item) },
      { key: 'test', icon: <Play size={14} />, label: testingId ? t('mcp.testing') : t('mcp.test'), disabled: testingId === item.id, onClick: () => handleTestMCP(item.id) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('mcp.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }

  if (d.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('mcp.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('mcp.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('mcp.col_name')}>
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('mcp.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={d.statusFilter} onChange={(v) => d.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'connected', label: MCP_STATUS_LABEL.connected },
            { value: 'disconnected', label: MCP_STATUS_LABEL.disconnected },
            { value: 'error', label: MCP_STATUS_LABEL.error },
          ]} />
        </div>
        <div className="wsta-toolbar-right">
          {d.selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={d.openBatchDelete}>{t('mcp.batch_delete', String(d.selectedIds.size))}</Button>}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={d.openCreate}>{t('mcp.new')}</Button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {d.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Server size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('mcp.empty_title', d.search ? '' : '')}</div>
            <div className="wsta-empty-state-desc">{d.search ? t('mcp.empty_desc_search') : t('mcp.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('mcp.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('mcp.select_all')} /></th>
            <th scope="col">{t('mcp.col_name')}</th>
            <th scope="col">{t('mcp.col_desc')}</th>
            <th scope="col">{t('mcp.col_type')}</th>
            <th scope="col">{t('mcp.col_status')}</th>
            <th scope="col">{t('mcp.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('mcp.col_actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('mcp.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-secondary-text wsta-truncate" title={item.description}>{item.description}</span></td>
                <td><span className="wsta-tag-pill wsta-tag-cyan">{item.type.toUpperCase()}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {MCP_STATUS_LABEL[item.status]}
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
        current={d.page}
        total={d.processed.length}
        pageSize={5}
        onChange={(p) => d.setPage(p)}
      />
      {d.isFormOpen && <MCPFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSave} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label="MCP" onConfirm={handleDelete} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="MCP" onConfirm={handleBatchDelete} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="mcp" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
