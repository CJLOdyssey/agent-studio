import { memo } from 'react';
import { FileCheck } from 'lucide-react';
import type { OutputEntry, OutputFormData } from './output.types';
import { OUTPUT_STATUS_LABEL } from './output.constants';
import { t } from './locales';
import Modal from '@/components/shared/Modal';

interface Props { editingItem: OutputEntry | null; formData: OutputFormData; setFormData: (fn: (f: OutputFormData) => OutputFormData) => void; onSave: () => void; onClose: () => void; formErrors?: string[]; }

const OutputFormModal = memo(function OutputFormModal({ editingItem, formData, setFormData, onSave, onClose, formErrors }: Props) {
  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <FileCheck size={16} />
          <h3>{editingItem ? t('output.form_title_edit') : t('output.form_title_new')}</h3>
        </div>
      }
      onClose={onClose}
      hideHeaderBorder
      hideFooterBorder
      width={540}
      ariaLabel={editingItem ? t('output.form_title_edit') : t('output.form_title_new')}
      bodyClassName="px-5 pb-5 gap-4"
      footer={
        <>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('output.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave} disabled={!formData.name.trim() || !formData.content.trim()}>{editingItem ? t('output.form_save_edit') : t('output.form_save_create')}</button>
        </>
      }
    >
      {formErrors && formErrors.length > 0 && (
        <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-md text-[var(--color-danger)] text-xs" role="alert">
          {formErrors.map((e, i) => <div key={i} className="leading-relaxed">{e}</div>)}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('output.form_name')} <span className="text-[var(--color-danger)]">*</span></label>
        <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('output.form_name_placeholder')} maxLength={50} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('output.form_content')} <span className="text-[var(--color-danger)]">*</span></label>
        <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" rows={4} value={formData.content} onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))} placeholder={t('output.form_content_placeholder')} />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('output.form_status')}</label>
        <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as OutputEntry['status'] }))}>
          {Object.entries(OUTPUT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
    </Modal>
  );
});

export default OutputFormModal;
