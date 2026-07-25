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
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--da-bg-secondary)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100vh/1.618)] overflow-hidden" role="dialog" aria-modal="true" aria-label={editingItem ? t('prompt.form_title_edit') : t('prompt.form_title_new')} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--da-border-subtle)]">
          <h3>{editingItem ? t('prompt.form_title_edit') : t('prompt.form_title_new')}</h3>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="p-3 bg-[var(--icon-status-error)]/10 border border-[var(--icon-status-error)]/30 rounded-md text-[var(--icon-status-error)] text-xs">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('prompt.form_name')} <span className="text-[var(--icon-status-error)]">{t('prompt.required')}</span></label>
            <input className="py-2 px-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--da-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('prompt.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('prompt.form_category')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as PromptCategory }))}>
                {PROMPT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('prompt.form_model')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.model} onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('prompt.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as PromptEntry['status'] }))}>
                {Object.entries(PROMPT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('prompt.form_version')} <span className="text-[var(--icon-status-error)]">{t('prompt.required')}</span></label>
              <input className="py-2 px-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--da-text-muted)]" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('prompt.form_version_placeholder')} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--da-text-secondary)]">{t('prompt.form_content')} <span className="text-[var(--icon-status-error)]">{t('prompt.required')}</span></label>
            <textarea className="py-2 px-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--da-text-muted)]" value={formData.content} onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))} placeholder={t('prompt.form_content_placeholder')} rows={6} maxLength={5000} />
            <div className="text-xs text-[var(--da-text-muted)] text-right">
              {t('prompt.form_char_count', { n: formData.content.length })}
              <span className="text-[var(--da-text-muted)]"> · {t('prompt.form_token_est', { n: Math.ceil(formData.content.length * 0.45) })}</span>
            </div>
            {(() => {
              const varMatches = [...formData.content.matchAll(/\{\{(.+?)\}\}/g)];
              if (varMatches.length === 0) return null;
              return (
                <div className="mt-2.5 flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--color-accent-soft)]">{t('prompt.form_var_detected', { n: varMatches.length })}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {varMatches.map((m, i) => (
                      <span key={i} className="inline-flex items-center py-[3px] px-2 rounded text-xs font-medium bg-[var(--color-accent-soft)]/[0.12] text-[var(--color-accent-soft)] border border-[var(--color-accent-soft)]/[0.22] cursor-default">{`{{${m[1].trim()}}}`}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--da-border-subtle)]">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose}>{t('prompt.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed" onClick={onSave}>{editingItem ? t('prompt.form_save_edit') : t('prompt.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
});

export default PromptFormModal;
