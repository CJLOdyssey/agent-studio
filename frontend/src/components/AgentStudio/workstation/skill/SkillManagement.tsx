import { Input, Select, Button, Dropdown, Modal, Tabs, Upload as AntdUpload, message } from 'antd';
import type { MenuProps } from 'antd';
import { Search, Plus, MoreHorizontal, Edit3, Eye, Trash2, Zap, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSkillManagement } from './useSkillManagement';
import { SKILL_STATUS_LABEL } from './skill.constants';
import SkillFormModal from './SkillFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import WstaPagination from '../shared/WstaPagination';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { getCategoryTagClass } from '../shared/categoryTag';
import { useToast } from '../../../../utils/useToast';
import { formatRelativeTime } from '../../../../utils/relativeTime';
import { importSkillFromMarkdown, importSkillDirectory } from '../../../../api/client/skills';
import { t } from './locales';

export default function SkillManagement() {
  const d = useSkillManagement();
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [importText, setImportText] = useState('');
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    const hasFiles = activeTab === 'upload' && importFiles.length > 0;
    const hasText = activeTab === 'paste' && importText.trim().length > 0;
    if (!hasFiles && !hasText) return;
    setImporting(true);
    try {
      const item = activeTab === 'upload'
        ? await importSkillDirectory(importFiles)
        : await importSkillFromMarkdown(importText);
      d.batchAdd([{
        id: item.id, name: item.name, description: item.description || '',
        category: item.category,
        status: (item.status === 'installed' || item.status === 'available' ? item.status : 'installed'),
        version: item.version || 'v1.0.0', author: item.author || '',
        instructions: item.instructions || '',
        tool_names: Array.isArray(item.tool_names) ? item.tool_names : [],
        output_constraint: item.output_constraint || '', createdAt: (item.created_at || '').slice(0, 10),
      }]);
      setImportOpen(false);
      setImportText('');
      setImportFiles([]);
      toast(t('skill.toast_imported'), 'success');
    } catch {
      message.error(t('skill.import_failed'));
    } finally {
      setImporting(false);
    }
  }

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

  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(d.processed.map((i) => i.category).filter(Boolean)));
    return [
      { value: 'all', label: t('skill.all_categories') },
      ...cats.map((c) => ({ value: c, label: c })),
    ];
  }, [d.processed]);

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
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('skill.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('skill.col_name')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label={t('skill.col_name')}>
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('skill.search_placeholder')} value={d.search} onChange={(e) => d.setSearch(e.target.value)} />
          <Select style={{ width: 140 }} value={d.categoryFilter} onChange={(v) => d.setCategoryFilter(v)} options={categoryOptions} />
          <Select style={{ width: 120 }} value={d.statusFilter} onChange={(v) => d.setStatusFilter(v)} options={[
            { value: 'all', label: '全部状态' },
            { value: 'installed', label: '已安装' },
            { value: 'available', label: '可用' },
          ]} />
        </div>
        <div className="flex items-center gap-3">
          {d.selectedIds.size > 0 && (
            <Button danger icon={<Trash2 size={16} />} onClick={() => d.openBatchDelete()}>
              {t('skill.batch_delete', String(d.selectedIds.size))}
            </Button>
          )}
          <Button icon={<Upload size={16} />} onClick={() => { setImportText(''); setImportFiles([]); setActiveTab('upload'); setImportOpen(true); }}>
            {t('skill.import_skill_md')}
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={d.openCreate}>
            {t('skill.new')}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {d.processed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <Zap size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('skill.empty_title')}</div>
            <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{d.search ? t('skill.empty_desc_search') : t('skill.empty_desc_general')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('skill.col_name')}>
          <thead><tr>
            <th className="w-10 text-center align-middle p-1 px-2" scope="col"><input type="checkbox" checked={d.allOnPageSelected} onChange={d.toggleSelectAll} aria-label={t('skill.select_all')} /></th>
            <th scope="col">{t('skill.col_name')}</th>
            <th scope="col">{t('skill.col_desc')}</th>
            <th scope="col">{t('skill.col_category')}</th>
            <th scope="col">{t('skill.col_status')}</th>
            <th scope="col">{t('workstation.createdAt')}</th>
            <th className="w-[100px] text-right" scope="col">{t('skill.col_actions')}</th>
          </tr></thead>
          <tbody>
            {d.paged.map((item) => (
              <tr key={item.id} className={d.selectedIds.has(item.id) ? 'wsta-row-selected' : ''}>
                <td className="w-10 text-center align-middle p-1 px-2"><input type="checkbox" checked={d.selectedIds.has(item.id)} onChange={() => d.toggleSelect(item.id)} aria-label={t('skill.select_item', item.name)} /></td>
                <td><span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span></td>
                <td><span className="text-sm text-[var(--color-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span></td>
                <td><span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{item.category}</span></td>
                <td>
                  <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
                    <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
                    {SKILL_STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td><span className="text-xs text-[var(--color-text-muted)]">{formatRelativeTime(item.createdAt)}</span></td>
                <td className="w-[100px] text-right">
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

      <WstaPagination
        current={d.page}
        total={d.processed.length}
        pageSize={7}
        onChange={(p) => d.setPage(p)}
      />

      {d.isFormOpen && <SkillFormModal editingSkill={d.editingItem} formData={d.formData} setFormData={d.setFormData} onSave={handleSaveWrapper} onClose={d.closeForm} errors={d.formErrors} />}
      {d.isDeleteOpen && <DeleteConfirmModal name={d.deletingItem?.name || ''} label="Skill" onConfirm={handleDeleteWrapper} onClose={d.closeDelete} />}
      {d.isBatchDeleteOpen && <BatchDeleteModal count={d.selectedIds.size} label="Skill" onConfirm={handleBatchDeleteWrapper} onClose={d.closeBatchDelete} />}
      {d.isHistoryOpen && d.historyItem && <VersionHistoryModal title={d.historyItem.name} resourceType="skill" resourceId={d.historyItem.id} onClose={d.closeHistory} />}
      <Modal
        title={t('skill.import_skill_md')}
        open={importOpen}
        destroyOnHidden
        onOk={handleImport}
        onCancel={() => setImportOpen(false)}
        okText={t('skill.import_confirm')}
        cancelText={t('skill.form_cancel')}
        confirmLoading={importing}
        okButtonProps={{ disabled: activeTab === 'upload' ? importFiles.length === 0 : !importText.trim() }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'upload' | 'paste')}
          items={[
            {
              key: 'upload',
              label: t('skill.import_upload_tab'),
              children: (
                <AntdUpload.Dragger
                  multiple
                  directory
                  beforeUpload={() => false}
                  onChange={({ fileList }) =>
                    setImportFiles(fileList.map((f) => f.originFileObj).filter(Boolean) as File[])
                  }
                >
                  <p><Upload size={24} /></p>
                  <p>{t('skill.import_upload_hint')}</p>
                  <p>{t('skill.import_file_required')}</p>
                </AntdUpload.Dragger>
              ),
            },
            {
              key: 'paste',
              label: t('skill.import_paste_tab'),
              children: (
                <>
                  <p style={{ marginBottom: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {t('skill.import_hint')}
                  </p>
                  <Input.TextArea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={10}
                    placeholder="---&#10;name: my-skill&#10;description: 技能描述&#10;allowed-tools:&#10;  - execute_python&#10;---&#10;&#10;# 用法&#10;..."
                    style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
                  />
                </>
              ),
            },
          ]}
        />
      </Modal>
    </div>
    </ErrorBoundary>
  );
}
