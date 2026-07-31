import { X, Server } from 'lucide-react';
import type { MCPEntry, MCPFormData } from './mcp.types';
import { MCP_TYPE_OPTIONS, MCP_TYPE_LABEL, MCP_STATUS_LABEL } from './mcp.constants';
import { t } from './locales';

interface Props { editingItem: MCPEntry | null; formData: MCPFormData; setFormData: (fn: (f: MCPFormData) => MCPFormData) => void; onSave: () => void; onClose: () => void; errors: string[]; }

export default function MCPFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100dvh/1.618)] overflow-hidden" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Server size={16} />
            <h3>{editingItem ? t('mcp.form_title_edit') : t('mcp.form_title_new')}</h3>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto flex-1 min-h-0 flex flex-col flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-md text-[var(--color-danger)] text-xs">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          {formData.type === 'sse' && (
            <div className="p-2 text-xs rounded-md bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-[var(--color-warning)]">
              {t('mcp.sse_warning')}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_name')} <span className="text-[var(--color-danger)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('mcp.form_name_placeholder')} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_desc')}</label>
            <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('mcp.form_desc_placeholder')} rows={3} maxLength={500} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_type')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.type} onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value as MCPEntry['type'] }))}>
                {MCP_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{MCP_TYPE_LABEL[o]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_status')}</label>
              <select className="py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as MCPEntry['status'] }))}>
                {Object.entries(MCP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {formData.type === 'stdio' ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_command')} <span className="text-[var(--color-danger)]">*</span></label>
                <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.command} onChange={(e) => setFormData((f) => ({ ...f, command: e.target.value, url: '' }))} placeholder={t('mcp.form_command_placeholder')} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_args')}</label>
                <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.args.join('\n')} onChange={(e) => setFormData((f) => ({ ...f, args: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))} placeholder={t('mcp.form_args_placeholder')} rows={2} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_env')}</label>
                <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.env.join('\n')} onChange={(e) => setFormData((f) => ({ ...f, env: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) }))} placeholder={t('mcp.form_env_placeholder')} rows={2} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_url')} <span className="text-[var(--color-danger)]">*</span></label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.url} onChange={(e) => setFormData((f) => ({ ...f, url: e.target.value, command: '' }))} placeholder={t('mcp.form_url_placeholder')} />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('mcp.form_version')} <span className="text-[var(--color-danger)]">*</span></label>
            <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.version} onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))} placeholder={t('mcp.form_version_placeholder')} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('mcp.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>{editingItem ? t('mcp.form_save_edit') : t('mcp.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
}
