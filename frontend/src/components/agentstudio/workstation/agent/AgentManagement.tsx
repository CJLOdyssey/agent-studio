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
    listPrompts().then((items) => { if (items.length > 0) setAvailPrompts(items.map((p) => ({ id: p.id, name: p.name }))); }).catch(() => {});
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
    } catch (err) {
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

  if (mgmt.isLoading) return <div className="wsta-panel" role="region" aria-label={t('agent.loading')}><TableSkeleton rows={5} cols={7} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-panel wsta-error-state" role="alert"><p>{t('agent.error_render')}</p></div>}>
    <div className="wsta-panel" role="region" aria-label="Agent 管理">
      {mgmt.error && <div className="wsta-error-banner"><span>{mgmt.error}</span><button onClick={mgmt.retry} aria-label={t('agent.error_retry')}><RefreshCw size={14} /></button><button onClick={mgmt.clearError}><X size={14} /></button></div>}
      {mgmt.batchError && <div className="wsta-error-banner" role="alert"><span>{mgmt.batchError}</span></div>}

      <div className="wsta-toolbar" role="toolbar" aria-label={t('agent.col_name')}>
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('agent.search_placeholder')} value={mgmt.search} onChange={(e) => mgmt.setSearch(e.target.value)} />
          <Select style={{ width: 130 }} value={mgmt.statusFilter} onChange={(v) => mgmt.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            ...Object.entries(STATUS_LABEL).map(([k, v]) => ({ value: k, label: v })),
          ]} />
        </div>
        <div className="wsta-toolbar-right">
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
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={mgmt.allOnPageSelected} onChange={mgmt.toggleSelectAll} aria-label={t('agent.select_all')} /></th>
            <th scope="col">{t('agent.col_name')}</th>
            <th scope="col">{t('agent.col_team')}</th>
            <th scope="col">{t('agent.col_model')}</th>
            <th scope="col">{t('agent.col_status')}</th>
            <th scope="col">{t('agent.col.version')}</th>
            <th className="wsta-col-actions" scope="col">{t('agent.col_actions')}</th>
          </tr></thead>
          <tbody>
            {mgmt.paged.map((item) => (
              <tr key={item.id} className={mgmt.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={mgmt.selectedIds.has(item.id)} onChange={() => mgmt.toggleSelect(item.id)} aria-label={t('agent.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-secondary-text">{item.team}</span></td>
                <td><span className="wsta-tag-pill wsta-tag-indigo">{item.model}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {STATUS_LABEL[item.status]}
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
