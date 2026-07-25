import { Input, Select, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Trash2, MessageSquare } from 'lucide-react';
import { usePromptManagement, PROMPT_CATEGORIES, t } from './index';
import PromptFormModal from './PromptFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import WstaPagination from '../shared/WstaPagination';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useToast } from '../../../../utils/useToast';

export default function PromptManagement() {
  const d = usePromptManagement();
  const { toast } = useToast();

  function handleSaveWrapper() { d.handleSave(); if (!d.formErrors.length) toast(d.editingItem ? t('prompt.toast_updated') : t('prompt.toast_created'), 'success'); }
  function handleDeleteWrapper() { d.handleDelete(); toast(t('prompt.toast_deleted'), 'success'); }
  function handleBatchDeleteWrapper() { d.handleBatchDelete(); toast(t('prompt.toast_batch_deleted'), 'success'); }

  const categoryTagClass: Record<string, string> = {
    '系统提示词': 'wsta-tag-indigo', '系统': 'wsta-tag-indigo',
    '用户提示词': 'wsta-tag-green', '自定义': 'wsta-tag-green',
    '任务模板': 'wsta-tag-amber', '模板': 'wsta-tag-amber',
    '角色定义': 'wsta-tag-indigo',
  };

  function makeMenuItems(item: typeof d.processed[0]): MenuProps['items'] {
    return [
      { key: 'edit', icon: <Edit3 size={14} />, label: t('prompt.edit'), onClick: () => d.openEdit(item) },
      { key: 'view', icon: <MessageSquare size={14} />, label: t('prompt.history'), onClick: () => d.openHistory(item) },
      { type: 'divider' },
      { key: 'delete', icon: <Trash2 size={14} />, label: t('prompt.delete'), onClick: () => d.openDelete(item), danger: true },
    ];
  }

  if (d.isLoading) return <div className="flex flex-col h-full" role="region" aria-label={t('prompt.loading')}><TableSkeleton rows={5} cols={6} /></div>;

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-col items-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('prompt.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label="提示词管理">
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label="操作工具栏">
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('prompt.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 140 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={[
            { value: 'all', label: t('prompt.all_categories') },
            ...PROMPT_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => d.openBatchDelete()}>
              {t('prompt.batch_delete', { n: String(d.selectedIds.size) })}
            </Button>
          )}
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>
            {t('prompt.new')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
            <MessageSquare size={40} className="text-[var(--da-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--da-text-secondary)]">{t('prompt.empty_title')}</div>
            <div className="text-sm text-[var(--da-text-muted)] max-w-80 leading-relaxed">{d.search ? t('prompt.empty_desc_search') : t('prompt.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-[var(--da-font-size-sm)]" role="grid" aria-label={t('prompt.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('prompt.select_all')} /></th>
            <th scope="col">{t('prompt.col_name')}</th>
            <th scope="col">{t('prompt.col_category')}</th>
            <th scope="col">{t('prompt.col_status')}</th>
            <th className="w-[60px] text-right" scope="col">{t('prompt.col_actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('prompt.select_item', { n: item.name })} /></td>
                <td><span className="font-semibold text-[var(--da-text-primary)] -tracking-[0.01em]">{item.name}</span></td>
                <td><span className={`wsta-tag-pill ${categoryTagClass[item.category] || 'wsta-tag-gray'}`}>{item.category}</span></td>
                <td><span>{item.status}</span></td>
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

      {d.isFormOpen && <PromptFormModal editingItem={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label={t('prompt.edit')} onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="提示词" onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="prompt" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
    </div>
    </ErrorBoundary>
  );
}
