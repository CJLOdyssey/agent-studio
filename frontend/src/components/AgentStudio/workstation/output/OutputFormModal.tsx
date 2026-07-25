import { memo, useEffect } from 'react';
import { X } from 'lucide-react';
import type { OutputEntry, OutputFormData } from './output.types';
import { OUTPUT_CATEGORIES, OUTPUT_STATUS_LABEL } from './output.constants';
import { t } from './locales';

interface Props { editingItem: OutputEntry | null; formData: OutputFormData; setFormData: (fn: (f: OutputFormData) => OutputFormData) => void; onSave: () => void; onClose: () => void; formErrors?: string[]; }

const OutputFormModal = memo(function OutputFormModal({ editingItem, formData, setFormData, onSave, onClose, formErrors }: Props) {
  useEffect(() => {
    function h(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--da-bg-secondary)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100vh/1.618)] overflow-hidden" role="dialog" aria-modal="true" aria-label={editingItem ? t('output.form_title_edit') : t('output.form_title_new')} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--da-border-subtle)]">
          <h3>{editingItem ? t('output.form_title_edit') : t('output.form_title_new')}</h3>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label={t('output.form_cancel')}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col flex flex-col gap-4">
          {formErrors && formErrors.length > 0 && (
            <div className="p-3 bg-[var(--icon-status-error)]/10 border border-[var(--icon-status-error)]/30 rounded-md text-[var(--icon-status-error)] text-xs" role="alert">
              {formErrors.map((e, i) => <div key={i} className="leading-relaxed">{e}</div>)}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('output.form_name')} <span className="text-[var(--icon-status-error)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--da-accent-indigo)] focus:shadow-[var(--da-focus-ring)] placeholder:text-[var(--da-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('output.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('output.form_content')} <span className="text-[var(--icon-status-error)]">*</span></label>
            <textarea className="py-2 px-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--da-accent-indigo)] focus:shadow-[var(--da-focus-ring)] placeholder:text-[var(--da-text-muted)]" rows={4} value={formData.content} onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))} placeholder={t('output.form_content_placeholder')} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('output.form_category')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--da-accent-indigo)] focus:shadow-[var(--da-focus-ring)]" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as OutputEntry['category'] }))}>
                {OUTPUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('output.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--da-accent-indigo)] focus:shadow-[var(--da-focus-ring)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as OutputEntry['status'] }))}>
                {Object.entries(OUTPUT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--da-border-subtle)]">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-accent-indigo)]" onClick={onClose}>{t('output.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed" onClick={onSave} disabled={!formData.name.trim() || !formData.content.trim()}>{editingItem ? t('output.form_save_edit') : t('output.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
});

export default OutputFormModal;
