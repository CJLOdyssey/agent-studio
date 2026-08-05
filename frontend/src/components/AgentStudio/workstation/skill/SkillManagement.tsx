import { Button, Dropdown, Input, Modal, Tabs, Upload as AntdUpload, message } from 'antd';
import type { MenuProps } from 'antd';
import { MoreHorizontal, Edit3, Eye, Trash2, Zap, Upload, Wrench, Radio } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSkillManagement } from './useSkillManagement';
import { SKILL_STATUS_LABEL } from './skill.constants';
import type { SkillEntry } from './skill.types';
import SkillFormModal from './SkillFormModal';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import BatchDeleteModal from '../shared/BatchDeleteModal';
import VersionHistoryModal from '../shared/VersionHistoryModal';
import ManagementTable from '../shared/ManagementTable';
import type { Column } from '../shared/ManagementTable';
import { getCategoryTagClass } from '../shared/categoryTag';
import { useToast } from '../../../../utils/useToast';
import { formatDateTime } from '../../../../utils/formatDateTime';
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
      void message.error(t('skill.import_failed'));
    } finally {
      setImporting(false);
    }
  }

  function handleSaveWrapper() {
    void d.handleSave();
    if (!d.formErrors.length) toast(d.editingItem ? t('skill.toast_updated') : t('skill.toast_created'), 'success');
  }
  function handleDeleteWrapper() {
    void d.handleDelete();
    toast(t('skill.toast_deleted'), 'success');
  }
  function handleBatchDeleteWrapper() {
    void d.handleBatchDelete();
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

  const columns: Column<SkillEntry>[] = [
    {
      key: 'name',
      title: t('skill.col_name'),
      render: (item) => (
        <span className="block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-[var(--color-text-primary)] -tracking-[0.01em]" title={item.name}>{item.name}</span>
      ),
    },
    { key: 'description', title: t('skill.col_desc'), render: (item) => <span className="text-sm text-[var(--color-text-secondary)] block max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.description}>{item.description}</span> },
    { key: 'category', title: t('skill.col_category'), render: (item) => <span className={`wsta-tag-pill ${getCategoryTagClass(item.category)}`}>{item.category}</span> },
    {
      key: 'status',
      title: t('skill.col_status'),
      render: (item) => (
        <span className={`wsta-badge-dot ${statusDotClass[item.status] || 'wsta-badge-dot-gray'}`}>
          <span className={`wsta-dot ${dotClass[item.status] || 'wsta-dot-gray'}`} />
          {SKILL_STATUS_LABEL[item.status]}
        </span>
      ),
    },
    {
      key: 'binding',
      title: t('skill.col_binding'),
      render: (item) => (
        <span className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          {item.tool_names?.length ? <span className="inline-flex items-center gap-1"><Wrench size={12} />{item.tool_names.length}</span> : null}
          {item.mcp_names?.length ? <span className="inline-flex items-center gap-1"><Radio size={12} />{item.mcp_names.length}</span> : null}
        </span>
      ),
    },
    { key: 'createdAt', title: t('workstation.createdAt'), render: (item) => <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(item.createdAt)}</span> },
    {
      key: 'actions',
      title: t('skill.col_actions'),
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
      <div className="h-full">
        <ManagementTable
          crud={d}
          label={t('skill.col_name')}
          loadingLabel={t('skill.loading')}
          errorFallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('skill.error_render')}</p></div>}
          columns={columns}
          searchPlaceholder={t('skill.search_placeholder')}
          categoryOptions={categoryOptions}
          categoryValue={d.categoryFilter}
          categorySelectWidth={140}
          onCategoryChange={d.setCategoryFilter}
          statusOptions={[
            { value: 'all', label: '全部状态' },
            { value: 'installed', label: '已安装' },
            { value: 'available', label: '可用' },
          ]}
          statusValue={d.statusFilter}
          onStatusChange={d.setStatusFilter}
          batchDeleteLabel={t('skill.batch_delete', String(d.selectedIds.size))}
          onBatchDelete={d.openBatchDelete}
          createLabel={t('skill.new')}
          onCreate={d.openCreate}
          toolbarActions={
            <Button
              icon={<Upload size={16} />}
              onClick={() => { setImportText(''); setImportFiles([]); setActiveTab('upload'); setImportOpen(true); }}
            >
              {t('skill.import_skill_md')}
            </Button>
          }
          selectAllLabel={t('skill.select_all')}
          selectItemLabel={(item) => t('skill.select_item', item.name)}
          emptyIcon={<Zap size={40} className="text-[var(--color-text-muted)] opacity-50" />}
          emptyTitle={t('skill.empty_title')}
          emptyDescription={t('skill.empty_desc_general')}
          emptySearchDescription={t('skill.empty_desc_search')}
        />
      </div>
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
    </>
  );
}
