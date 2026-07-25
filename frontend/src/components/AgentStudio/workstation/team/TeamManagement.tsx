import { useState } from 'react';
import { Input, Select, Button, Dropdown } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, UserCog, Trash2, X, Users, RefreshCw } from 'lucide-react';
import { useTeamManagement } from './useTeamManagement';
import { TEAM_STATUS_LABEL } from './team.constants';
import TeamFormModal from './TeamFormModal';
import TeamMemberManager from './TeamMemberManager';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import WstaPagination from '../shared/WstaPagination';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';
import type { TeamEntry } from './team.types';

const CATEGORY_CLASS: Record<string, string> = { dev: 'wsta-tag-indigo', ops: 'wsta-tag-green', test: 'wsta-tag-amber' };
const CATEGORY_LABEL: Record<string, string> = { dev: t('team.category_dev'), ops: t('team.category_ops'), test: t('team.category_test') };

export default function TeamManagement() {
  const d = useTeamManagement();
  const { toast } = useToast();
  const [memberMgmtTeam, setMemberMgmtTeam] = useState<TeamEntry | null>(null);

  function handleSaveWrapper() { d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('team.toast_updated') : t('team.toast_created'), 'success'); }
  function handleDeleteWrapper() { d.handleDelete(); toast(t('team.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { d.handleBatchDelete(); toast(t('team.toast_batch_deleted', String(d.selectedIds.size)), 'success'); }

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('team.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-col items-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('team.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('team.col_name')}>
      {d.error && <div className="flex items-center gap-3 py-3 px-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg text-[var(--color-danger)] text-sm mb-4"><span>{d.error}</span><button onClick={d.retry} aria-label={t('team.error_retry')}><RefreshCw size={14} /></button><button onClick={d.clearError}><X size={14} /></button></div>}
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar">
        <div className="flex items-center gap-3 flex-1" style={{ flexWrap: 'wrap' }}>
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('team.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 120 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)}
            options={[
              { value: 'all', label: t('team.all_category') },
              { value: 'dev', label: t('team.category_dev') },
              { value: 'ops', label: t('team.category_ops') },
              { value: 'test', label: t('team.category_test') },
            ]} />
          <Select style={{ width: 120 }} value={d.statusFilter} onChange={(v) => d.setStatusFilter(v)}
            options={[
              { value: 'all', label: t('team.all_status') },
              { value: 'active', label: t('team.status_active') },
              { value: 'inactive', label: t('team.status_inactive') },
            ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && (
            <Button danger onClick={() => d.openBatchDelete()}><Trash2 size={14} /> {t('team.batch_delete', String(d.selectedIds.size))}</Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>
            {t('team.new')}
          </Button>
        </div>
      </div>
      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
            <Users size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('team.empty_title', '')}</div>
            <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{d.search ? t('team.empty_desc_search') : t('team.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-[var(--da-font-size-sm)]" role="grid" aria-label={t('team.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('team.select_all')} /></th>
            <th scope="col">{t('workstation.name')}</th>
            <th scope="col">{t('workstation.memberCount')}</th>
            <th scope="col">{t('workstation.category')}</th>
            <th scope="col">{t('workstation.status')}</th>
            <th scope="col">{t('workstation.createdAt')}</th>
            <th className="w-[60px] text-right" scope="col">{t('workstation.actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('team.select_item', item.name)} /></td>
                <td><span className="font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]">{item.name}</span></td>
                <td><span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-surface-raised)] text-xs font-semibold text-[var(--color-text-secondary)]">{item.memberCount}</span></td>
                <td><span className={`wsta-tag-pill ${CATEGORY_CLASS[item.category] || 'wsta-tag-indigo'}`}>{CATEGORY_LABEL[item.category] || item.category}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${item.status === 'active' ? 'wsta-badge-dot-green' : 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${item.status === 'active' ? 'wsta-dot-green' : 'wsta-dot-gray'}`} />
                    {TEAM_STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td><span className="font-mono text-xs text-[var(--color-text-muted)]">{item.createdAt}</span></td>
                <td className="w-[60px] text-right">
                  <Dropdown menu={{ items: [
                    { key: 'edit', icon: <Edit3 size={14} />, label: t('team.edit'), onClick: () => d.openEdit(item) },
                    { key: 'view', icon: <Eye size={14} />, label: t('team.history'), onClick: () => d.openHistory(item) },
                    { key: 'members', icon: <UserCog size={14} />, label: t('team.manage_members'), onClick: () => setMemberMgmtTeam(item) },
                    { type: 'divider' },
                    { key: 'delete', icon: <Trash2 size={14} />, label: t('team.delete'), danger: true, onClick: () => d.openDelete(item) },
                  ] }} trigger={['click']}>
                    <button className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-[var(--color-text-muted)] cursor-pointer transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"><MoreHorizontal size={14} /></button>
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
      {d.isFormOpen && <TeamFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label={t('team.delete')} onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="team" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
      {memberMgmtTeam && <TeamMemberManager team={memberMgmtTeam} onClose={() => setMemberMgmtTeam(null)} />}
    </div>
    </ErrorBoundary>
  );
}
