import { useEffect, useMemo, useState } from 'react';
import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Trash2, GitBranch, RefreshCw, X, Eye, Play } from 'lucide-react';
import { listWorkflows, deleteWorkflow, submitRequirement } from '../../../../api/client';
import type { WorkflowSummary } from '../../../../types/AgentStudio';
import WstaPagination from '../shared/WstaPagination';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';

const PAGE_SIZE = 7;

interface WorkflowListProps {
  teams: Array<{ id: string; name: string }>;
  onCreateWorkflow: (teamId: string) => void;
  onOpenWorkflow: (workflow: WorkflowSummary) => void;
}

type DerivedStatus = 'active' | 'draft';

function deriveStatus(workflow: WorkflowSummary): DerivedStatus {
  return workflow.nodeCount > 0 ? 'active' : 'draft';
}

export default function WorkflowList({ teams, onCreateWorkflow, onOpenWorkflow }: WorkflowListProps) {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<WorkflowSummary | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<WorkflowSummary | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    listWorkflows()
      .then((data) => setWorkflows(data))
      .catch(() => setError(t('workflow.error_loading')))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, []);

  const statusLabel: Record<DerivedStatus, string> = { active: t('workflow.status_active'), draft: t('workflow.status_draft') };
  const statusDotClass: Record<DerivedStatus, string> = { active: 'wsta-badge-dot-green', draft: 'wsta-badge-dot-gray' };
  const dotClass: Record<DerivedStatus, string> = { active: 'wsta-dot-green', draft: 'wsta-dot-gray' };

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows
      .map((wf) => ({ ...wf, derivedStatus: deriveStatus(wf) }))
      .filter((wf) => {
        const matchesSearch = !q || wf.name.toLowerCase().includes(q) || (wf.teamName || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || wf.derivedStatus === statusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [workflows, search, statusFilter]);

  const paged = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allOnPageSelected = paged.length > 0 && paged.every((wf) => selectedIds.has(wf.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach((wf) => next.delete(wf.id));
      else paged.forEach((wf) => next.add(wf.id));
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorkflow(deleteTarget.id);
      toast(t('workflow.toast_deleted'), 'success');
      setDeleteTarget(null);
      reload();
    } catch {
      toast(t('workflow.toast_delete_failed'), 'error');
      setDeleteTarget(null);
    }
  };

  const handleBatchDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteWorkflow(id)));
      toast(t('workflow.toast_batch_deleted', String(selectedIds.size)), 'success');
      setBatchOpen(false);
      setSelectedIds(new Set());
      reload();
    } catch {
      toast(t('workflow.toast_batch_delete_failed'), 'error');
      setBatchOpen(false);
    }
  };

  const handleTestRun = async (workflow: WorkflowSummary) => {
    const requirement = window.prompt(t('workflow.test_prompt'), t('workflow.test_prompt_default'));
    if (requirement === null || !requirement.trim()) return;
    setTestingId(workflow.id);
    try {
      const res = await submitRequirement(requirement.trim(), undefined, undefined, undefined, undefined, workflow.teamId);
      toast(`${t('workflow.test_started')} (${res.run_id})`, 'success');
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      toast(`❌ ${err.response?.data?.detail || err.message || t('workflow.test_failed')}`, 'error');
    } finally {
      setTestingId(null);
    }
  };

  function makeMenuItems(workflow: WorkflowSummary): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('workflow.edit'), onClick: () => onOpenWorkflow(workflow) },
      { key: 'view', icon: <Eye size={14} />, label: t('workflow.history'), onClick: () => setHistoryItem(workflow) },
      { key: 'test', icon: <Play size={14} />, label: testingId === workflow.id ? t('workflow.testing') : t('workflow.test'), disabled: testingId === workflow.id, onClick: () => handleTestRun(workflow) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('workflow.delete'), danger: true, onClick: () => setDeleteTarget(workflow) },
    ];
  }

  if (loading) return <div className="flex flex-col h-full" role="region" aria-label={t('workflow.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('workflow.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('workflow.col_name')}>
      {error && <div className="flex items-center gap-3 py-3 px-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg text-[var(--color-danger)] text-sm mb-4"><span>{error}</span><button onClick={reload} aria-label={t('workflow.error_retry')}><RefreshCw size={14} /></button><button onClick={() => setError(null)}><X size={14} /></button></div>}
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar">
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('workflow.search_placeholder')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select style={{ width: 130 }} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} options={[
            { value: 'all', label: t('workflow.all_status') },
            { value: 'active', label: statusLabel.active },
            { value: 'draft', label: statusLabel.draft },
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && <Button danger icon={<Trash2 size={16} />} onClick={() => setBatchOpen(true)}>{t('workflow.batch_delete', String(selectedIds.size))}</Button>}
          <Dropdown menu={{ items: teams.map((team) => ({ key: team.id, label: team.name, onClick: () => onCreateWorkflow(team.id) })) }} trigger={['click']}>
            <Button type="primary" icon={<Plus size={16} />}>{t('workflow.new')}</Button>
          </Dropdown>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {processed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <GitBranch size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('workflow.empty_title')}</div>
            <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{search ? t('workflow.empty_desc_search') : t('workflow.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('workflow.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} aria-label={t('workflow.select_all')} /></th>
            <th scope="col">{t('workflow.col_name')}</th>
            <th scope="col">{t('workflow.col_team')}</th>
            <th scope="col">{t('workflow.col_nodes')}</th>
            <th scope="col">{t('workstation.status')}</th>
            <th scope="col">{t('workstation.createdAt')}</th>
            <th className="w-[100px] text-right" scope="col">{t('workstation.actions')}</th>
          </tr></thead>
          <tbody>
            {paged.map((item) => (
              <tr key={item.id} className={`cursor-pointer ${selectedIds.has(item.id) ? 'wsta-row-selected' : ''}`} onClick={() => onOpenWorkflow(item)}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} onClick={(e) => e.stopPropagation()} aria-label={t('workflow.select_item', item.name)} /></td>
                <td><span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span></td>
                <td><span className="text-sm text-[var(--color-text-secondary)]">{item.teamName || '—'}</span></td>
                <td><span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-[var(--color-surface-raised)] text-xs font-semibold text-[var(--color-text-secondary)]">{item.nodeCount}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.derivedStatus]}`}>
                    <span className={`wsta-dot ${dotClass[item.derivedStatus]}`} />
                    {statusLabel[item.derivedStatus]}
                  </span>
                </td>
                <td><span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span></td>
                <td className="w-[100px] text-right" onClick={(e) => e.stopPropagation()}>
                  <Dropdown menu={{ items: makeMenuItems(item) }} trigger={['click']}>
                    <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
                  </Dropdown>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <WstaPagination current={page} total={processed.length} pageSize={PAGE_SIZE} onChange={(p) => setPage(p)} />

      {deleteTarget && <DeleteConfirmModal name={deleteTarget.name} label={t('workflow.col_name')} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
      {batchOpen && <BatchDeleteModal count={selectedIds.size} label={t('workflow.col_name')} onConfirm={handleBatchDelete} onClose={() => setBatchOpen(false)} />}
      {historyItem && <VersionHistoryModal title={historyItem.name} resourceType="workflow" resourceId={historyItem.id} onClose={() => setHistoryItem(null)} />}
    </div>
    </ErrorBoundary>
  );
}
