import { Input, Select, Button, Dropdown } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, UserCog, Trash2, X, Users, RefreshCw } from 'lucide-react';
import { useTeamData } from './useTeamData';
import { useTeamUI } from './useTeamUI';
import { TEAM_STATUS_LABEL } from './team.constants';
import { MOCK_TEAM_VERSIONS } from './mock-data';
import TeamFormModal from './TeamFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import WstaPagination from '../shared/WstaPagination';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

const CATEGORY_CLASS: Record<string, string> = { dev: 'wsta-tag-indigo', ops: 'wsta-tag-green', test: 'wsta-tag-amber' };
const CATEGORY_LABEL: Record<string, string> = { dev: '开发', ops: '运维', test: '测试' };

export default function TeamManagement() {
  const data = useTeamData();
  const ui = useTeamUI();
  const { toast } = useToast();

  function handleSaveWrapper() { ui.save(data); if (ui.formErrors.length === 0) toast(ui.editingItem ? t('team.toast_updated') : t('team.toast_created'), 'success'); }
  function handleDeleteWrapper() { ui.confirmDelete(data); toast(t('team.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { ui.confirmBatchDelete(data); toast(t('team.toast_batch_deleted', String(data.selectedIds.size)), 'success'); }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('team.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('team.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('team.col_name')}>
      {data.error && <div className="wsta-error-banner"><span>{data.error}</span><button onClick={data.retry} aria-label={t('team.error_retry')}><RefreshCw size={14} /></button><button onClick={data.clearError}><X size={14} /></button></div>}
      <div className="wsta-toolbar" role="toolbar">
        <div className="wsta-toolbar-left" style={{ flexWrap: 'wrap' }}>
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('team.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} />
          <Select style={{ width: 120 }} value={data.categoryFilter} onChange={(v) => data.setCategoryFilter(v)}
            options={[{ value: 'all', label: '全部分类' }, { value: 'dev', label: '开发' }, { value: 'ops', label: '运维' }, { value: 'test', label: '测试' }]} />
          <Select style={{ width: 120 }} value={data.statusFilter} onChange={(v) => data.setStatusFilter(v)}
            options={[{ value: 'all', label: '全部状态' }, { value: 'active', label: '活跃' }, { value: 'inactive', label: '已停用' }]} />
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && (
            <Button danger onClick={() => ui.openBatchDelete()}><Trash2 size={14} /> {t('team.batch_delete', String(data.selectedIds.size))}</Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={ui.openCreate}>
            {t('team.new')}
          </Button>
        </div>
      </div>
      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Users size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('team.empty_title', '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('team.empty_desc_search') : t('team.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('team.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('team.select_all')} /></th>
            <th scope="col">名称</th>
            <th scope="col">成员数</th>
            <th scope="col">分类</th>
            <th scope="col">状态</th>
            <th scope="col">创建时间</th>
            <th className="wsta-col-actions" scope="col">操作</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('team.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-member-circle-new">{item.memberCount}</span></td>
                <td><span className={`wsta-tag-pill ${CATEGORY_CLASS[item.category] || 'wsta-tag-indigo'}`}>{CATEGORY_LABEL[item.category] || item.category}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${item.status === 'active' ? 'wsta-badge-dot-green' : 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${item.status === 'active' ? 'wsta-dot-green' : 'wsta-dot-gray'}`} />
                    {TEAM_STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td><span className="wsta-mono-text">{item.createdAt}</span></td>
                <td className="wsta-col-actions">
                  <Dropdown menu={{ items: [
                    { key: 'edit', icon: <Edit3 size={14} />, label: '编辑', onClick: () => ui.openEdit(item) },
                    { key: 'view', icon: <Eye size={14} />, label: '查看详情', onClick: () => ui.openHistory(item) },
                    { key: 'members', icon: <UserCog size={14} />, label: '管理成员', onClick: () => ui.openEdit(item) },
                    { type: 'divider' },
                    { key: 'delete', icon: <Trash2 size={14} />, label: '删除', danger: true, onClick: () => ui.openDelete(item) },
                  ] }} trigger={['click']}>
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
      {ui.isFormOpen && <TeamFormModal editingItem={ui.editingItem} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSaveWrapper} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && <DeleteConfirmModal name={ui.deletingItem?.name || ''} label={t('team.delete')} onConfirm={handleDeleteWrapper} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} onConfirm={handleBatchDeleteWrapper} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historyItem && <VersionHistoryModal title={ui.historyItem.name} versions={MOCK_TEAM_VERSIONS[ui.historyItem.id] || []} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
