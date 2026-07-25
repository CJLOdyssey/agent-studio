import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ToolEntry, ToolFormData } from './tool.types';
import { TOOL_CATEGORIES, TOOL_STATUS_LABEL } from './tool.constants';
import { useModelOptions } from '../constants';
import { t } from './locales';
import { testTool, type ToolTestResult } from '../../../../api/client/tools';

interface Props {
  editingItem: ToolEntry | null;
  formData: ToolFormData;
  setFormData: (fn: (f: ToolFormData) => ToolFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

export default function ToolFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
  const modelOptions = useModelOptions();
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<ToolTestResult | null>(null);

  const handleTest = async () => {
    if (!editingItem) {
      setTestResult({ success: false, status_code: null, duration_ms: 0, message: t('tool.test_no_endpoint'), body: null });
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testTool(editingItem.id);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, status_code: null, duration_ms: 0, message: 'Request failed', body: null });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100dvh/1.618)] overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h3>{editingItem ? t('tool.form_title_edit') : t('tool.form_title_new')}</h3>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="p-3 bg-[var(--icon-status-error)]/10 border border-[var(--icon-status-error)]/30 rounded-md text-[var(--icon-status-error)] text-xs">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_name')} <span className="text-[var(--icon-status-error)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('tool.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_desc')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('tool.form_desc_placeholder')} rows={3} maxLength={500} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_category')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                {TOOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_model')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.model} onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as ToolEntry['status'] }))}>
                {Object.entries(TOOL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_version')} <span className="text-[var(--icon-status-error)]">*</span></label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('tool.form_version_placeholder')} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_endpoint')}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" style={{ flex: 1 }} value={formData.endpoint} onChange={(e) => setFormData((f) => ({ ...f, endpoint: e.target.value }))} placeholder={t('tool.form_endpoint_placeholder')} />
              <button
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 12px', flexShrink: 0 }}
                onClick={handleTest}
                disabled={testLoading || !formData.endpoint}
              >
                {testLoading ? <Loader2 size={14} className="spin" /> : testResult?.success ? <CheckCircle size={14} /> : testResult ? <XCircle size={14} /> : null}
                {testLoading ? t('tool.testing') : testResult ? `${testResult.status_code ?? 'ERR'}` : t('tool.test')}
              </button>
            </div>
            {testResult && (
              <div style={{ fontSize: 12, marginTop: 4, color: testResult.success ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
                {testResult.message}{testResult.duration_ms > 0 ? ` — ${testResult.duration_ms}ms` : ''}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_parameters')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)] font-mono text-xs" value={formData.parameters} onChange={(e) => setFormData((f) => ({ ...f, parameters: e.target.value }))} placeholder={t('tool.form_parameters_placeholder')} rows={4} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('tool.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={onSave}>{editingItem ? t('tool.form_save_edit') : t('tool.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
}
