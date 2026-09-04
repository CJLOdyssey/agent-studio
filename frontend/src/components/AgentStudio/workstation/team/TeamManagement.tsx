import { useState, useMemo, useEffect } from 'react';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, Edit3, Eye, UserCog, Trash2, X, Users, RefreshCw, GitBranch } from 'lucide-react';
import { useTeamManagement } from './useTeamManagement';
import { TEAM_STATUS_LABEL, getCategoryTagClass } from './team.constants';
import TeamFormModal from './TeamFormModal';
import TeamMemberManager from './TeamMemberManager';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
import { t } from './locales';
import type { TeamEntry } from './team.types';
import { listWorkflows } from '../../../../api/client/workflows';

export default function TeamManagement() {
  const d = useTeamManagement();
  const { toast } = useToast();
  const [memberMgmtTeam, setMemberMgmtTeam] = useState<TeamEntry | null>(null);
  const [workflowTeamIds, setWorkflowTeamIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    listWorkflows()
      .then((ws) => setWorkflowTeamIds(new Set(ws.map((w) => w.teamId))))
      .catch(() => {});
  }, []);

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(d.teams.map((t) => t.category).filter(Boolean)));
    return [
      { value: 'all' as const, label: t('team.all_category') },
      ...cats.map((c) => ({ value: c, label: c })),
    ];
  }, [d.teams]);

  function handleSaveWrapper() { void d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('team.toast_updated') : t('team.toast_created'), 'success'); }
  function handleDeleteWrapper() { void d.handleDelete(); toast(t('team.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { void d.handleBatchDelete(); toast(t('team.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  function makeMenuItems(item: TeamEntry): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('team.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('team.history'), onClick: () => d.openHistory(item) },
      { key: 'members', icon: <UserCog size={14} />, label: t('team.manage_members'), onClick: () => setMemberMgmtTeam(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('team.delete'), danger: true, onClick: () => d.openDelete(item) },
    ];
  }

  const columns: Column<TeamEntry>[] = [
    {
      key: 'name',
      title: t('workstation.name'),
      render: (item) => (
        <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
      ),
    },
    { key: 'memberCount', title: t('workstation.memberCount'), render: (item) => <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-surface-raised)] text-xs font-semibold text-[var(--color-text-secondary)]">{item.memberCount}</span> },
    { key: 'category', title: t('workstation.category'), render: (item) => <span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{item.category || ''}</span> },
    {
      key: 'workflow',
      title: t('team.col_workflow'),
      render: (item) => workflowTeamIds.has(item.id) ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"><GitBranch size={12} />{t('team.workflow_bound')}</span>
      ) : (
        <span className="text-xs text-[var(--color-text-muted)]">{t('team.workflow_unbound')}</span>
      ),
    },
    {
      key: 'status',
      title: t('workstation.status'),
      render: (item) => (
        <span className={`wsta-badge-dot ${item.status === 'active' ? 'wsta-badge-dot-green' : 'wsta-badge-dot-gray'}`}>
          <span className={`wsta-dot ${item.status === 'active' ? 'wsta-dot-green' : 'wsta-dot-gray'}`} />
          {TEAM_STATUS_LABEL[item.status]}
        </span>
      ),
    },
    { key: 'createdAt', title: t('workstation.createdAt'), render: (item) => <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span> },
    {
      key: 'actions',
      title: t('workstation.actions'),
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
      <div className="flex flex-col h-full">
        {d.error && <div className="flex items-center gap-3 py-3 px-4 mb-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg text-[var(--color-danger)] text-sm shrink-0"><span>{d.error}</span><button onClick={d.retry} aria-label={t('team.error_retry')}><RefreshCw size={14} /></button><button onClick={d.clearError}><X size={14} /></button></div>}
        <div className="flex-1 min-h-0">
          <ManagementTable
            crud={d}
            label={t('team.col_name')}
            loadingLabel={t('team.loading')}
            errorFallback={<div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('team.error_render')}</p></div>}
            columns={columns}
            searchPlaceholder={t('team.search_placeholder')}
            categoryOptions={categoryOptions}
            categoryValue={d.categoryFilter}
            categorySelectWidth={120}
            onCategoryChange={(v) => d.setCategoryFilter(v)}
            statusOptions={[
              { value: 'all', label: t('team.all_status') },
              { value: 'active', label: t('team.status_active') },
              { value: 'disabled', label: t('team.status_disabled') },
            ]}
            statusValue={d.statusFilter}
            onStatusChange={(v) => d.setStatusFilter(v as 'all' | TeamEntry['status'])}
            createLabel={t('team.new')}
            onCreate={d.openCreate}
            batchDeleteLabel={t('team.batch_delete', String(d.selectedIds.size))}
            onBatchDelete={d.openBatchDelete}
            selectAllLabel={t('team.select_all')}
            selectItemLabel={(item) => t('team.select_item', item.name)}
            emptyIcon={<Users size={40} className="text-[var(--color-text-muted)] opacity-50" />}
            emptyTitle={t('team.empty_title')}
            emptyDescription={t('team.empty_desc_general')}
            emptySearchDescription={t('team.empty_desc_search')}
          />
        </div>
      </div>
      {d.isFormOpen && <TeamFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label={t('team.delete')} onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="team" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
      {memberMgmtTeam && <TeamMemberManager team={memberMgmtTeam} onClose={() => { setMemberMgmtTeam(null); d.retry(); }} />}
    </>
  );
}
