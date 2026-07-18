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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{editingItem ? t('tool.form_title_edit') : t('tool.form_title_new')}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body wsta-modal-body">
          {errors.length > 0 && (
            <div className="wsta-form-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="wsta-form-group">
            <label className="wsta-label">{t('tool.form_name')} <span className="wsta-required">*</span></label>
            <input className="wsta-input" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('tool.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('tool.form_desc')}</label>
            <textarea className="wsta-textarea" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('tool.form_desc_placeholder')} rows={3} maxLength={500} />
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('tool.form_category')}</label>
              <select className="wsta-select" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                {TOOL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('tool.form_model')}</label>
              <select className="wsta-select" value={formData.model} onChange={(e) => setFormData((f) => ({ ...f, model: e.target.value }))}>
                {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('tool.form_status')}</label>
              <select className="wsta-select" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as ToolEntry['status'] }))}>
                {Object.entries(TOOL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('tool.form_version')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('tool.form_version_placeholder')} />
            </div>
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('tool.form_endpoint')}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="wsta-input" style={{ flex: 1 }} value={formData.endpoint} onChange={(e) => setFormData((f) => ({ ...f, endpoint: e.target.value }))} placeholder={t('tool.form_endpoint_placeholder')} />
              <button
                className="btn btn-secondary"
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
          <div className="wsta-form-group">
            <label className="wsta-label">{t('tool.form_parameters')}</label>
            <textarea className="wsta-textarea" value={formData.parameters} onChange={(e) => setFormData((f) => ({ ...f, parameters: e.target.value }))} placeholder={t('tool.form_parameters_placeholder')} rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('tool.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>{editingItem ? t('tool.form_save_edit') : t('tool.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
}
