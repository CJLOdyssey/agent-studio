import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, Edit3, Eye, Play, Trash2, Server } from 'lucide-react';
import { useState } from 'react';
import { useMcpManagement } from './useMCPManagement';
import { MCP_STATUS_LABEL } from './mcp.constants';
import MCPFormModal from './MCPFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';
import type { MCPEntry } from './mcp.types';

export default function MCPManagement() {
  const d = useMcpManagement();
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

  function handleSave() { void d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('mcp.toast_updated') : t('mcp.toast_created'), 'success'); }
  function handleDelete() { void d.handleDelete(); toast(t('mcp.toast_deleted'), 'success'); }
  function handleBatchDelete() { void d.handleBatchDelete(); toast(t('mcp.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { connected: 'wsta-badge-dot-green', disconnected: 'wsta-badge-dot-gray', error: 'wsta-badge-dot-red' };
  const dotClass: Record<string, string> = { connected: 'wsta-dot-green', disconnected: 'wsta-dot-gray', error: 'wsta-dot-red' };

  function makeMenuItems(item: MCPEntry): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('mcp.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('mcp.history'), onClick: () => d.openHistory(item) },
      { key: 'test', icon: <Play size={14} />, label: testingId ? t('mcp.testing') : t('mcp.test'), disabled: testingId === item.id, onClick: () => handleTestMCP(item.id) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('mcp.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }

  const columns: Column<MCPEntry>[] = [
    {
      key: 'name',
      title: t('mcp.col_name'),
      render: (item) => (
        <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
      ),
    },
    { key: 'description', title: t('mcp.col_desc'), render: (item) => <span className="text-sm text-[var(--color-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span> },
    { key: 'type', title: t('mcp.col_type'), render: (item) => <span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/15 text-[var(--color-accent)]">{item.type.toUpperCase()}</span> },
    {
      key: 'status',
      title: t('mcp.col_status'),
      render: (item) => (
        <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
          <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
          {MCP_STATUS_LABEL[item.status]}
        </span>
      ),
    },
    { key: 'createdAt', title: t('workstation.createdAt'), render: (item) => <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span> },
    {
      key: 'actions',
      title: t('mcp.col_actions'),
      className: 'w-[100px] text-right',
      render: (item) => (
        <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <ManagementTable
        crud={d}
        label={t('mcp.col_name')}
        loadingLabel={t('mcp.loading')}
        errorFallback={<div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('mcp.error_render')}</p></div>}
        columns={columns}
        searchPlaceholder={t('mcp.search_placeholder')}
        categoryOptions={[
          { value: 'all', label: t('mcp.all_types') },
          { value: 'stdio', label: 'stdio' },
          { value: 'sse', label: 'sse' },
        ]}
        categoryValue={d.typeFilter}
        categorySelectWidth={120}
        onCategoryChange={d.setTypeFilter}
        statusOptions={[
          { value: 'all', label: '全部状态' },
          { value: 'connected', label: MCP_STATUS_LABEL.connected },
          { value: 'disconnected', label: MCP_STATUS_LABEL.disconnected },
          { value: 'error', label: MCP_STATUS_LABEL.error },
        ]}
        statusValue={d.statusFilter}
        statusSelectWidth={130}
        onStatusChange={d.setStatusFilter}
        createLabel={t('mcp.new')}
        onCreate={d.openCreate}
        batchDeleteLabel={t('mcp.batch_delete', String(d.selectedIds.size))}
        onBatchDelete={d.openBatchDelete}
        selectAllLabel={t('mcp.select_all')}
        selectItemLabel={(item) => t('mcp.select_item', item.name)}
        emptyIcon={<Server size={40} className="text-[var(--color-text-muted)] opacity-50" />}
        emptyTitle={t('mcp.empty_title')}
        emptyDescription={t('mcp.empty_desc_general')}
        emptySearchDescription={t('mcp.empty_desc_search')}
      />
      {d.isFormOpen && <MCPFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSave} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label="MCP" onConfirm={handleDelete} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="MCP" onConfirm={handleBatchDelete} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="mcp" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </>
  );
}
