import { memo, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import type { PromptEntry, PromptFormData } from './types';
import { useModelOptions } from '../constants';
import { PROMPT_STATUS_LABEL, PROMPT_CATEGORY_LABEL, t } from './index';
import Modal from '@/components/shared/Modal';

interface Props {
  editingItem: PromptEntry | null;
  formData: PromptFormData;
  setFormData: (fn: (f: PromptFormData) => PromptFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

const PromptFormModal = memo(function PromptFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
  const modelOptions = useModelOptions();
  // 创建模式下，若默认 model 不在可用模型列表中，对齐到第一个可用模型
  // （emptyForm.model 硬编码为 GPT-4o，而选项来自 key vault，两者可能不一致）
  useEffect(() => {
    if (!editingItem && modelOptions.length > 0 && !modelOptions.includes(formData.model)) {
      setFormData((f) => ({ ...f, model: modelOptions[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingItem, modelOptions]);
  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <MessageSquare size={16} />
          <h3>{editingItem ? t('prompt.form_title_edit') : t('prompt.form_title_new')}</h3>
        </div>
      }
      onClose={onClose}
      hideHeaderBorder
      hideFooterBorder
      width={560}
      ariaLabel={editingItem ? t('prompt.form_title_edit') : t('prompt.form_title_new')}
      bodyClassName="px-5 pb-5 gap-4"
      footer={
        <>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('prompt.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>{editingItem ? t('prompt.form_save_edit') : t('prompt.form_save_create')}</button>
        </>
      }
    >
      {errors.length > 0 && (
            <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-md text-[var(--color-danger)] text-xs">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_name')} <span className="text-[var(--color-danger)]">{t('prompt.required')}</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('prompt.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_description')} <span className="text-[var(--color-danger)]">{t('prompt.required')}</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description ?? ''} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('prompt.form_description_placeholder')} maxLength={200} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_category')}</label>
              <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                {Object.entries(PROMPT_CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_model')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.model} onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as PromptEntry['status'] }))}>
                {Object.entries(PROMPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_version')}</label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('prompt.form_version_placeholder')} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('prompt.form_content')} <span className="text-[var(--color-danger)]">{t('prompt.required')}</span></label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.content} onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))} placeholder={t('prompt.form_content_placeholder')} rows={6} maxLength={5000} />
            <p className="text-xs text-[var(--color-text-muted)]">{t('prompt.form_content_hint')}</p>
          </div>
    </Modal>
  );
});

export default PromptFormModal;
