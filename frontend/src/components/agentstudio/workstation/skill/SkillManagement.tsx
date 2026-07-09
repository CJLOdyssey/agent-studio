import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Zap } from 'lucide-react';
import { useSkillData } from './useSkillData';
import { useSkillUI } from './useSkillUI';
import { SKILL_CATEGORIES, SKILL_STATUS_LABEL } from './skill.constants';
import SkillFormModal from './SkillFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import WstaPagination from '../shared/WstaPagination';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';
import { t } from './locales';

export default function SkillManagement() {
  const data = useSkillData();
  const ui = useSkillUI();
  const { toast } = useToast();

  function handleSaveWrapper() { ui.save(data); if (!ui.formErrors.length) toast(ui.editingSkill ? t('skill.toast_updated') : t('skill.toast_created'), 'success'); }
  function handleDeleteWrapper() { ui.confirmDelete(data); toast(t('skill.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { ui.confirmBatchDelete(data); toast(t('skill.toast_batch_deleted', String(data.selectedIds.size)), 'success'); }

  const statusDotClass: Record<string, string> = { installed: 'wsta-badge-dot-green', available: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { installed: 'wsta-dot-green', available: 'wsta-dot-gray' };

  function makeMenuItems(item: typeof data.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('skill.edit'), onClick: () => ui.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('skill.history'), onClick: () => ui.openHistory(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('skill.delete'), onClick: () => ui.openDelete(item), danger: true },
    ];
  }

  if (data.isLoading) return <div className="wsta-agent-mgmt" role="region" aria-label={t('skill.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('skill.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('skill.col_name')}>
      <div className="wsta-toolbar" role="toolbar" aria-label={t('skill.col_name')}>
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('skill.search_placeholder')} value={data.search} onChange={(e) => data.setSearch(e.target.value)} />
          <Select style={{ width: 140 }} value={data.categoryFilter} onChange={(v) => data.setCategoryFilter(v)} options={[
            { value: 'all', label: t('skill.all_categories') },
            ...SKILL_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]} />
        </div>
        <div className="wsta-toolbar-right">
          {data.selectedIds.size > 0 && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => ui.openBatchDelete()}>
              {t('skill.batch_delete', String(data.selectedIds.size))}
            </Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} style={{ background: 'var(--da-bg-hover)', borderColor: 'var(--da-bg-hover)', color: 'var(--da-text-primary)' }} onClick={ui.openCreate}>
            {t('skill.new')}
          </Button>
        </div>
      </div>

      <div className="wsta-table-wrap">
        {data.processed.length === 0 ? (
          <div className="wsta-empty-state">
            <Zap size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('skill.empty_title', data.search ? '' : '')}</div>
            <div className="wsta-empty-state-desc">{data.search ? t('skill.empty_desc_search') : t('skill.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('skill.col_name')}>
          <thead><tr>
            <th className="wsta-col-checkbox" scope="col"><input type="checkbox" checked={data.allOnPageSelected} onChange={data.toggleSelectAll} aria-label={t('skill.select_all')} /></th>
            <th scope="col">{t('skill.col_name')}</th>
            <th scope="col">{t('skill.col_desc')}</th>
            <th scope="col">{t('skill.col_category')}</th>
            <th scope="col">{t('skill.col_status')}</th>
            <th scope="col">{t('skill.col_version')}</th>
            <th className="wsta-col-actions" scope="col">{t('skill.col_actions')}</th>
          </tr></thead>
          <tbody>
            {data.paged.map((item) => (
              <tr key={item.id} className={data.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="wsta-col-checkbox"><input type="checkbox" checked={data.selectedIds.has(item.id)} onChange={() => data.toggleSelect(item.id)} aria-label={t('skill.select_item', item.name)} /></td>
                <td><span className="wsta-agent-name">{item.name}</span></td>
                <td><span className="wsta-secondary-text wsta-truncate" title={item.description}>{item.description}</span></td>
                <td><span className="wsta-tag-pill wsta-tag-indigo">{item.category}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {SKILL_STATUS_LABEL[item.status]}
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
        current={data.page}
        total={data.processed.length}
        pageSize={5}
        onChange={(p) => data.setPage(p)}
      />

      {ui.isFormOpen && <SkillFormModal editingSkill={ui.editingSkill} formData={ui.formData} setFormData={ui.setFormData} onSave={handleSaveWrapper} onClose={ui.closeForm} errors={ui.formErrors} />}
      {ui.isDeleteOpen && <DeleteConfirmModal name={ui.deletingSkill?.name || ''} label="Skill" onConfirm={handleDeleteWrapper} onClose={ui.closeDelete} />}
      {ui.isBatchDeleteOpen && <BatchDeleteModal count={data.selectedIds.size} label="Skill" onConfirm={handleBatchDeleteWrapper} onClose={ui.closeBatchDelete} />}
      {ui.isHistoryOpen && ui.historySkill && <VersionHistoryModal title={ui.historySkill.name} resourceType="skill" resourceId={ui.historySkill.id} onClose={ui.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
