import { Search, Plus, MoreHorizontal, Edit3, Eye, Play, Trash2, X, Bot, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useAgentManagement } from './useAgentManagement';
import { STATUS_LABEL } from './agent.constants';
import AgentFormModal from './AgentFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import WstaPagination from '../shared/WstaPagination';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';
import { listPrompts } from '../../../../api/client/prompts';
import { listTools } from '../../../../api/client/tools';
import { listMCPs } from '../../../../api/client/mcps';
import { listSkills } from '../../../../api/client/skills';

export default function AgentManagement() {
  const mgmt = useAgentManagement();
  const { toast } = useToast();

  const [availPrompts, setAvailPrompts] = useState<{ id: string; name: string }[]>([]);
  const [availTools, setAvailTools] = useState<{ id: string; name: string }[]>([]);
  const [availMCPs, setAvailMCPs] = useState<{ id: string; name: string }[]>([]);
  const [availSkills, setAvailSkills] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    listPrompts().then((items) => { const filtered = items.filter((p) => p.category !== 'output_constraint'); if (filtered.length > 0) setAvailPrompts(filtered.map((p) => ({ id: p.id, name: p.name }))); }).catch(() => {});
    listTools().then((items) => { if (items.length > 0) setAvailTools(items.map((t) => ({ id: t.id, name: t.name }))); }).catch(() => {});
    listMCPs().then((items) => { if (items.length > 0) setAvailMCPs(items.map((m) => ({ id: m.id, name: m.name }))); }).catch(() => {});
    listSkills().then((items) => { if (items.length > 0) setAvailSkills(items.map((s) => ({ id: s.id, name: s.name }))); }).catch(() => {});
  }, []);

  function handleSaveWrapper() { mgmt.handleSave(); if (mgmt.formErrors.length === 0) toast(mgmt.editingAgent ? t('agent.toast_updated') : t('agent.toast_created'), 'success'); }
  function handleDeleteWrapper() { mgmt.handleDelete(); toast(t('agent.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { mgmt.handleBatchDelete(); toast(t('agent.toast_batch_deleted', String(mgmt.selectedIds.size)), 'success'); }

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
      { key: 'delete', icon: <Trash2 size={14} />, label: t('agent.delete'), onClick: () => mgmt.openDelete(item), danger: true },
    ];
  }

  if (mgmt.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('agent.loading')}><TableSkeleton rows={5} cols={7} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-col items-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('agent.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label="Agent 管理">
      {mgmt.error && <div className="flex items-center gap-3 py-3 px-4 bg-[var(--icon-status-error)]/10 border border-[var(--icon-status-error)]/30 rounded-lg text-[var(--icon-status-error)] text-sm mb-4"><span>{mgmt.error}</span><button onClick={mgmt.retry} aria-label={t('agent.error_retry')}><RefreshCw size={14} /></button><button onClick={mgmt.clearError}><X size={14} /></button></div>}
      {mgmt.batchError && <div className="flex items-center gap-3 py-3 px-4 bg-[var(--icon-status-error)]/10 border border-[var(--icon-status-error)]/30 rounded-lg text-[var(--icon-status-error)] text-sm mb-4" role="alert"><span>{mgmt.batchError}</span></div>}

      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label={t('agent.col_name')}>
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('agent.search_placeholder')} value={mgmt.search} onChange={(e) => mgmt.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={mgmt.statusFilter} onChange={(v) => mgmt.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {mgmt.selectedIds.size > 0 && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => mgmt.openBatchDelete()}>
              {t('agent.batch_delete', String(mgmt.selectedIds.size))}
            </Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={mgmt.openCreate}>
            {t('agent.new')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {mgmt.processed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
            <Bot size={40} className="text-[var(--da-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--da-text-secondary)]">{t('agent.empty_title', mgmt.search ? '' : '')}</div>
            <div className="text-sm text-[var(--da-text-muted)] max-w-80 leading-relaxed">{mgmt.search ? t('agent.empty_desc_search') : t('agent.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-[var(--da-font-size-sm)]" role="grid" aria-label={t('agent.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={mgmt.allOnPageSelected} onChange={mgmt.toggleSelectAll} aria-label={t('agent.select_all')} /></th>
            <th scope="col">{t('agent.col_name')}</th>
            <th scope="col">{t('agent.col_team')}</th>
            <th scope="col">{t('agent.col_model')}</th>
            <th scope="col">{t('agent.col_status')}</th>
            <th scope="col">{t('agent.col.version')}</th>
            <th className="w-[60px] text-right" scope="col">{t('agent.col_actions')}</th>
          </tr></thead>
          <tbody>
            {mgmt.paged.map((item) => (
              <tr key={item.id} className={mgmt.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={mgmt.selectedIds.has(item.id)} onChange={() => mgmt.toggleSelect(item.id)} aria-label={t('agent.select_item', item.name)} /></td>
                <td><span className="font-semibold text-[var(--da-text-primary)] -tracking-[0.01em]">{item.name}</span></td>
                <td><span className="text-sm text-[var(--da-text-secondary)]">{item.team}</span></td>
                <td><span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--da-accent-indigo)]/8 text-[var(--da-accent-indigo)]">{item.model}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td><span className="font-mono text-xs text-[var(--da-text-muted)]">{item.version}</span></td>
                <td className="w-[60px] text-right">
                  <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
                    <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--da-text-muted)] cursor-pointer transition-all hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]"><MoreHorizontal size={14} /></button>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <WstaPagination
        current={mgmt.page}
        total={mgmt.processed.length}
        pageSize={5}
        onChange={(p) => mgmt.setPage(p)}
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
    </ErrorBoundary>
  );
}
