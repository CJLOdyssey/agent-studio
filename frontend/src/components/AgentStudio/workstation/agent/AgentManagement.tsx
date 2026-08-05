import { useState, useEffect, useMemo } from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, Edit3, Eye, Play, Trash2, X, Bot, RefreshCw } from 'lucide-react';
import { useAgentManagement } from './useAgentManagement';
import { STATUS_LABEL } from './agent.constants';
import AgentFormModal from './AgentFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';
import { listPrompts } from '../../../../api/client/prompts';
import { listTools, listToolPlugins } from '../../../../api/client/tools';
import { listMCPs } from '../../../../api/client/mcps';
import { listSkills } from '../../../../api/client/skills';
import type { AgentEntry } from './agent.types';
import type { StatusFilter } from './agent.types';

export default function AgentManagement() {
  const mgmt = useAgentManagement();
  const { toast } = useToast();

  const [availPrompts, setAvailPrompts] = useState<{ id: string; name: string }[]>([]);
  const [availTools, setAvailTools] = useState<{ id: string; name: string }[]>([]);
  const [availMCPs, setAvailMCPs] = useState<{ id: string; name: string }[]>([]);
  const [availSkills, setAvailSkills] = useState<{ id: string; name: string }[]>([]);

  const teamOptions = useMemo(() => {
    const teams = new Set<string>();
    for (const a of mgmt.processed) {
      if (a.teams?.length) a.teams.forEach((tm) => teams.add(tm));
      else if (a.team) teams.add(a.team);
    }
    return [
      { value: 'all', label: t('agent.all_teams') },
      ...[...teams].sort((x, y) => x.localeCompare(y, 'zh-CN')).map((tm) => ({ value: tm, label: tm })),
    ];
  }, [mgmt.processed]);

  useEffect(() => {
    listPrompts().then((items) => { const filtered = items.filter((p) => p.category !== 'output_constraint'); if (filtered.length > 0) setAvailPrompts(filtered.map((p) => ({ id: p.id, name: p.name }))); }).catch(() => {});
    Promise.all([listTools(), listToolPlugins()]).then(([tools, plugins]) => {
      const merged = [
        ...tools.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
        ...plugins.map((p: { tool_name: string; label: string }) => ({ id: p.tool_name, name: p.label })),
      ];
      if (merged.length > 0) setAvailTools(merged);
    }).catch(() => {});
    listMCPs().then((items) => { if (items.length > 0) setAvailMCPs(items.map((m) => ({ id: m.id, name: m.name }))); }).catch(() => {});
    listSkills().then((items) => { if (items.length > 0) setAvailSkills(items.map((s) => ({ id: s.id, name: s.name }))); }).catch(() => {});
  }, []);

  function handleSaveWrapper() {
    const p = mgmt.handleSave();
    if (p) p.then(() => toast(mgmt.editingAgent ? t('agent.toast_updated') : t('agent.toast_created'), 'success'));
  }
  function handleDeleteWrapper() { const p = mgmt.handleDelete(); if (p) p.then(() => toast(t('agent.toast_deleted'), 'success')); }
  function handleBatchDeleteWrapper() { const p = mgmt.handleBatchDelete(); if (p) p.then(() => toast(t('agent.toast_batch_deleted', String(mgmt.selectedIds.size)), 'success')); }

  const statusDotClass: Record<string, string> = { running: 'wsta-badge-dot-green', stopped: 'wsta-badge-dot-gray', error: 'wsta-badge-dot-red' };
  const dotClass: Record<string, string> = { running: 'wsta-dot-green', stopped: 'wsta-dot-gray', error: 'wsta-dot-red' };

  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleTestAgent(id: string) {
    setTestingId(id);
    try {
      const res = await fetch(`/api/agents/${id}/test`, { method: 'POST' });
      const data = await res.json();
      toast(data.success ? `✅ ${data.message} (${data.duration_ms}ms)` : `❌ ${data.message}`, data.success ? 'success' : 'error');
    } catch {
      toast('❌ 测试请求失败', 'error');
    } finally {
      setTestingId(null);
    }
  }
  function makeMenuItems(item: typeof mgmt.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('agent.edit'), onClick: () => mgmt.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('agent.history'), onClick: () => mgmt.openHistory(item) },
      { key: 'test', icon: <Play size={14} />, label: testingId === item.id ? t('agent.testing') : t('agent.test'), disabled: testingId === item.id, onClick: () => handleTestAgent(item.id) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('agent.delete'), disabled: item.status === 'running', onClick: () => mgmt.openDelete(item), danger: true },
    ];
  }

  const columns: Column<AgentEntry>[] = [
    {
      key: 'name',
      title: t('agent.col_name'),
      render: (item) => (
        <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
      ),
    },
    {
      key: 'team',
      title: t('agent.col_team'),
      render: (item) => (
        <span className="text-sm text-[var(--color-text-secondary)]">{item.teams?.length ? item.teams.join('、') : item.team || ''}</span>
      ),
    },
    {
      key: 'model',
      title: t('agent.col_model'),
      render: (item) => (
        <span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">{item.model}</span>
      ),
    },
    {
      key: 'status',
      title: t('agent.col_status'),
      render: (item) => (
        <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
          <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
          {STATUS_LABEL[item.status]}
        </span>
      ),
    },
    {
      key: 'createdAt',
      title: t('workstation.createdAt'),
      render: (item) => (
        <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      title: t('agent.col_actions'),
      className: 'w-[100px] text-right',
      render: (item) => (
        <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
          <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
        </Dropdown>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full" role="region" aria-label="Agent 管理">
      {mgmt.error && <div className="flex items-center gap-3 py-3 px-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg text-[var(--color-danger)] text-sm mb-4"><span>{mgmt.error}</span><button onClick={mgmt.retry} aria-label={t('agent.error_retry')}><RefreshCw size={14} /></button><button onClick={mgmt.clearError}><X size={14} /></button></div>}
      {mgmt.batchError && <div className="flex items-center gap-3 py-3 px-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg text-[var(--color-danger)] text-sm mb-4" role="alert"><span>{mgmt.batchError}</span></div>}

      <ManagementTable
        crud={mgmt}
        label={t('agent.col_name')}
        loadingLabel={t('agent.loading')}
        errorFallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('agent.error_render')}</p></div>}
        columns={columns}
        searchPlaceholder={t('agent.search_placeholder')}
        categoryOptions={teamOptions}
        categoryValue={mgmt.teamFilter}
        onCategoryChange={mgmt.setTeamFilter}
        statusOptions={[
          { value: 'all', label: '全部状态' },
          ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
        ]}
        statusValue={mgmt.statusFilter}
        onStatusChange={(v) => mgmt.setStatusFilter(v as StatusFilter)}
        statusSelectWidth={130}
        createLabel={t('agent.new')}
        onCreate={mgmt.openCreate}
        batchDeleteLabel={t('agent.batch_delete', String(mgmt.selectedIds.size))}
        onBatchDelete={mgmt.openBatchDelete}
        selectAllLabel={t('agent.select_all')}
        selectItemLabel={(item) => t('agent.select_item', item.name)}
        emptyIcon={<Bot size={40} className="text-[var(--color-text-muted)] opacity-50" />}
        emptyTitle={t('agent.empty_title')}
        emptyDescription={t('agent.empty_desc_general')}
        emptySearchDescription={t('agent.empty_desc_search')}
      />

      {mgmt.isFormOpen && mgmt.editingAgent && (
        <AgentFormModal key="edit" editingAgent={mgmt.editingAgent} formData={mgmt.formData} setFormData={mgmt.setFormData} onSave={handleSaveWrapper} onClose={() => mgmt.setIsFormOpen(false)} formErrors={mgmt.formErrors} availablePrompts={availPrompts} availableTools={availTools} availableMCPs={availMCPs} availableSkills={availSkills} />
      )}
      {mgmt.isFormOpen && !mgmt.editingAgent && (
        <AgentFormModal key="create" editingAgent={null} formData={mgmt.formData} setFormData={mgmt.setFormData} onSave={handleSaveWrapper} onClose={() => mgmt.setIsFormOpen(false)} formErrors={mgmt.formErrors} availablePrompts={availPrompts} availableTools={availTools} availableMCPs={availMCPs} availableSkills={availSkills} />
      )}
      {mgmt.isDeleteOpen && <DeleteConfirmModal name={mgmt.deletingAgent?.name || ''} label={t('agent.edit')} onConfirm={handleDeleteWrapper} onClose={() => mgmt.setIsDeleteOpen(false)} />}
      {mgmt.isBatchDeleteOpen && <BatchDeleteModal count={mgmt.selectedIds.size} onConfirm={handleBatchDeleteWrapper} onClose={() => mgmt.setIsBatchDeleteOpen(false)} />}
      {mgmt.isHistoryOpen && mgmt.historyAgent && <VersionHistoryModal title={mgmt.historyAgent.name} resourceType="agent" resourceId={mgmt.historyAgent.id} onClose={() => mgmt.setIsHistoryOpen(false)} />}
    </div>
  );
}
