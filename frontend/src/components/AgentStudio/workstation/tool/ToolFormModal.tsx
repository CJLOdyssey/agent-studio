import { CheckCircle, XCircle, Loader2, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { ToolEntry, ToolFormData } from './tool.types';
import { TOOL_STATUS_LABEL } from './tool.constants';
import { t } from './locales';
import { testTool, type ToolTestResult } from '../../../../api/client/tools';
import Modal from '@/components/shared/Modal';

interface Props {
  editingItem: ToolEntry | null;
  formData: ToolFormData;
  setFormData: (fn: (f: ToolFormData) => ToolFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

export default function ToolFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
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
    <Modal
      title={
        <div className="flex items-center gap-3">
          <Wrench size={16} />
          <h3>{editingItem ? t('tool.form_title_edit') : t('tool.form_title_new')}</h3>
        </div>
      }
      onClose={onClose}
      hideHeaderBorder
      hideFooterBorder
      width={560}
      bodyClassName="px-5 pb-5 gap-4"
      footer={
        <>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('tool.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>{editingItem ? t('tool.form_save_edit') : t('tool.form_save_create')}</button>
        </>
      }
    >
      {errors.length > 0 && (
            <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-md text-[var(--color-danger)] text-xs">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_name')} <span className="text-[var(--color-danger)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('tool.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_desc')} <span className="text-[var(--color-danger)]">*</span></label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('tool.form_desc_placeholder')} rows={3} maxLength={500} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_category')}</label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))} placeholder="例如：内置工具、自定义工具" />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as ToolEntry['status'] }))} aria-label="状态">
                {Object.entries(TOOL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_version')}</label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('tool.form_version_placeholder')} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_endpoint')}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select className="py-2 px-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" style={{ width: 84, flexShrink: 0 }} value={formData.method || 'GET'} onChange={(e) => setFormData((f) => ({ ...f, method: e.target.value }))} aria-label={t('tool.form_method')}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
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
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_headers')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)] font-mono text-xs" value={formData.headers || ''} onChange={(e) => setFormData((f) => ({ ...f, headers: e.target.value }))} placeholder={'{"Authorization": "Bearer ..."}'} rows={2} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('tool.form_parameters')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)] font-mono text-xs" value={formData.parameters} onChange={(e) => setFormData((f) => ({ ...f, parameters: e.target.value }))} placeholder={t('tool.form_parameters_placeholder')} rows={4} />
          </div>
    </Modal>
  );
}
