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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal" role="dialog" aria-modal="true" aria-label={editingItem ? t('output.form_title_edit') : t('output.form_title_new')} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <h3>{editingItem ? t('output.form_title_edit') : t('output.form_title_new')}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('output.form_cancel')}><X size={18} /></button>
        </div>
        <div className="modal-body wsta-modal-body">
          {formErrors && formErrors.length > 0 && (
            <div className="wsta-form-errors" role="alert">
              {formErrors.map((e, i) => <div key={i} className="wsta-form-error-item">{e}</div>)}
            </div>
          )}
          <div className="wsta-form-group">
            <label className="wsta-label">{t('output.form_name')} <span className="wsta-required">*</span></label>
            <input className="wsta-input" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('output.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('output.form_content')} <span className="wsta-required">*</span></label>
            <textarea className="wsta-textarea" rows={4} value={formData.content} onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))} placeholder={t('output.form_content_placeholder')} />
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('output.form_category')}</label>
              <select className="wsta-select" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as OutputEntry['category'] }))}>
                {OUTPUT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('output.form_status')}</label>
              <select className="wsta-select" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as OutputEntry['status'] }))}>
                {Object.entries(OUTPUT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('output.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave} disabled={!formData.name.trim() || !formData.content.trim()}>{editingItem ? t('output.form_save_edit') : t('output.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
});

export default OutputFormModal;
