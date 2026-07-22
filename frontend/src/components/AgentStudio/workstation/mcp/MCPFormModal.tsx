import { X } from 'lucide-react';
import type { MCPEntry, MCPFormData } from './mcp.types';
import { MCP_TYPE_OPTIONS, MCP_STATUS_LABEL } from './mcp.constants';
import { t } from './locales';

interface Props { editingItem: MCPEntry | null; formData: MCPFormData; setFormData: (fn: (f: MCPFormData) => MCPFormData) => void; onSave: () => void; onClose: () => void; errors: string[]; }

export default function MCPFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{editingItem ? t('mcp.form_title_edit') : t('mcp.form_title_new')}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body wsta-modal-body">
          {errors.length > 0 && (
            <div className="wsta-form-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <div className="wsta-form-group">
            <label className="wsta-label">{t('mcp.form_name')} <span className="wsta-required">*</span></label>
            <input className="wsta-input" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('mcp.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('mcp.form_desc')}</label>
            <textarea className="wsta-textarea" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('mcp.form_desc_placeholder')} rows={3} maxLength={500} />
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('mcp.form_type')}</label>
              <select className="wsta-select" value={formData.type} onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value as MCPEntry['type'] }))}>
                {MCP_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('mcp.form_status')}</label>
              <select className="wsta-select" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as MCPEntry['status'] }))}>
                {Object.entries(MCP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {formData.type === 'stdio' ? (
            <div className="wsta-form-group">
              <label className="wsta-label">{t('mcp.form_command')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.command} onChange={(e) => setFormData((f) => ({ ...f, command: e.target.value, url: '' }))} placeholder={t('mcp.form_command_placeholder')} />
            </div>
          ) : (
            <div className="wsta-form-group">
              <label className="wsta-label">{t('mcp.form_url')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.url} onChange={(e) => setFormData((f) => ({ ...f, url: e.target.value, command: '' }))} placeholder={t('mcp.form_url_placeholder')} />
            </div>
          )}
          <div className="wsta-form-group">
            <label className="wsta-label">{t('mcp.form_version')} <span className="wsta-required">*</span></label>
            <input className="wsta-input" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('mcp.form_version_placeholder')} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('mcp.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>{editingItem ? t('mcp.form_save_edit') : t('mcp.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
}
