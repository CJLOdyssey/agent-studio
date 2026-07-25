import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Zap } from 'lucide-react';
import { useSkillManagement } from './useSkillManagement';
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
  const d = useSkillManagement();
  const { toast } = useToast();

  function handleSaveWrapper() {
    d.handleSave();
    if (!d.formErrors.length) toast(d.editingItem ? t('skill.toast_updated') : t('skill.toast_created'), 'success');
  }
  function handleDeleteWrapper() {
    d.handleDelete();
    toast(t('skill.toast_deleted'), 'success');
  }
  function handleBatchDeleteWrapper() {
    d.handleBatchDelete();
    toast(t('skill.toast_batch_deleted', String(d.selectedIds.size)), 'success');
  }

  const statusDotClass: Record<string, string> = { installed: 'wsta-badge-dot-green', available: 'wsta-badge-dot-gray' };
  const dotClass: Record<string, string> = { installed: 'wsta-dot-green', available: 'wsta-dot-gray' };

  function makeMenuItems(item: typeof d.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('skill.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <Eye size={14} />, label: t('skill.history'), onClick: () => d.openHistory(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('skill.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('skill.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-col items-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('skill.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('skill.col_name')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label={t('skill.col_name')}>
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('skill.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 140 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={[
            { value: 'all', label: t('skill.all_categories') },
            ...SKILL_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => d.openBatchDelete()}>
              {t('skill.batch_delete', String(d.selectedIds.size))}
            </Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>
            {t('skill.new')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
            <Zap size={40} className="text-[var(--da-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--da-text-secondary)]">{t('skill.empty_title', d.search ? '' : '')}</div>
            <div className="text-sm text-[var(--da-text-muted)] max-w-80 leading-relaxed">{d.search ? t('skill.empty_desc_search') : t('skill.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-[var(--da-font-size-sm)]" role="grid" aria-label={t('skill.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('skill.select_all')} /></th>
            <th scope="col">{t('skill.col_name')}</th>
            <th scope="col">{t('skill.col_desc')}</th>
            <th scope="col">{t('skill.col_category')}</th>
            <th scope="col">{t('skill.col_status')}</th>
            <th scope="col">{t('skill.col_version')}</th>
            <th className="w-[60px] text-right" scope="col">{t('skill.col_actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('skill.select_item', item.name)} /></td>
                <td><span className="font-semibold text-[var(--da-text-primary)] -tracking-[0.01em]">{item.name}</span></td>
                <td><span className="text-sm text-[var(--da-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span></td>
                <td><span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">{item.category}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {SKILL_STATUS_LABEL[item.status]}
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
        current={d.page}
        total={d.processed.length}
        pageSize={5}
        onChange={(p) => d.setPage(p)}
      />

      {d.isFormOpen && <SkillFormModal editingSkill={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label="Skill" onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="Skill" onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="skill" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
