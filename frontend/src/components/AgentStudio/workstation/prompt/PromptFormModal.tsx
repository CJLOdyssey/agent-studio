import { memo, useEffect } from 'react';
import { X } from 'lucide-react';
import type { PromptEntry, PromptFormData, PromptCategory } from './types';
import { useModelOptions } from '../constants';
import { PROMPT_CATEGORIES, PROMPT_STATUS_LABEL, t } from './index';

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
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal" role="dialog" aria-modal="true" aria-label={editingItem ? t('prompt.form_title_edit') : t('prompt.form_title_new')} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{editingItem ? t('prompt.form_title_edit') : t('prompt.form_title_new')}</h3>
          <button className="modal-close" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="modal-body wsta-modal-body">
          {errors.length > 0 && (
            <div className="wsta-form-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="wsta-form-group">
            <label className="wsta-label">{t('prompt.form_name')} <span className="wsta-required">{t('prompt.required')}</span></label>
            <input className="wsta-input" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('prompt.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('prompt.form_category')}</label>
              <select className="wsta-select" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as PromptCategory }))}>
                {PROMPT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('prompt.form_model')}</label>
              <select className="wsta-select" value={formData.model} onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('prompt.form_status')}</label>
              <select className="wsta-select" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as PromptEntry['status'] }))}>
                {Object.entries(PROMPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('prompt.form_version')} <span className="wsta-required">{t('prompt.required')}</span></label>
              <input className="wsta-input" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('prompt.form_version_placeholder')} />
            </div>
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('prompt.form_content')} <span className="wsta-required">{t('prompt.required')}</span></label>
            <textarea className="wsta-textarea" value={formData.content} onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))} placeholder={t('prompt.form_content_placeholder')} rows={6} maxLength={5000} />
            <div className="wsta-char-count">
              {t('prompt.form_char_count', { n: formData.content.length })}
              <span className="wsta-token-estimate"> · {t('prompt.form_token_est', { n: Math.ceil(formData.content.length * 0.45) })}</span>
            </div>
            {(() => {
              const varMatches = [...formData.content.matchAll(/\{\{(.+?)\}\}/g)];
              if (varMatches.length === 0) return null;
              return (
                <div className="wsta-var-section">
                  <span className="wsta-var-badge">{t('prompt.form_var_detected', { n: varMatches.length })}</span>
                  <div className="wsta-var-tags">
                    {varMatches.map((m, i) => (
                      <span key={i} className="wsta-tag wsta-tag-var">{`{{${m[1].trim()}}}`}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('prompt.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>{editingItem ? t('prompt.form_save_edit') : t('prompt.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
});

export default PromptFormModal;
