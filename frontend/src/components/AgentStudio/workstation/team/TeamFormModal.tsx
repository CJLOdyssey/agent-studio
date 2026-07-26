import { memo, useCallback } from 'react';
import { X, Users } from 'lucide-react';
import type { TeamEntry, TeamFormData } from './team.types';
import { t } from './locales';

interface Props {
  editingItem: TeamEntry | null;
  formData: TeamFormData;
  setFormData: (fn: (f: TeamFormData) => TeamFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

const CATEGORY_OPTIONS: { value: TeamFormData['category']; labelKey: string }[] = [
  { value: 'dev', labelKey: 'team.category_dev' },
  { value: 'ops', labelKey: 'team.category_ops' },
  { value: 'test', labelKey: 'team.category_test' },
];

function TeamFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100dvh/1.618)] overflow-hidden max-w-[var(--modal-sm)] animate-[agentFormIn_0.25s_ease-out]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Users size={16} className="text-[var(--color-accent)]" />
            <h3>{editingItem ? t('team.form_title_edit') : t('team.form_title_new')}</h3>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>

        <div className="px-5 pb-5 overflow-y-auto flex-1 min-h-0 flex flex-col">
          {errors.length > 0 && <div className="p-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-md text-[var(--color-danger)] text-xs">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}

          <div className="pt-4">
            <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">基本信息</div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('team.form_name')} <span className="text-[var(--color-danger)]">*</span></label>
              <input className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('team.form_name_placeholder')} maxLength={50} autoFocus />
            </div>
            <div className="flex flex-col gap-1" style={{ marginTop: 14 }}>
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('team.form_desc')}</label>
              <textarea className="py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors resize-y min-h-20 leading-relaxed focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('team.form_desc_placeholder')} rows={3} />
            </div>
            <div className="flex gap-4" style={{ marginTop: 14 }}>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('team.form_category')}</label>
                <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as TeamFormData['category'] }))}>
                  {CATEGORY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>))}
                </select>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">{t('team.form_status')}</label>
                <select className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}>
                  <option value="active">{t('team.status_active')}</option>
                  <option value="inactive">{t('team.status_inactive')}</option>
                </select>
              </div>
            </div>
          </div>


        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('team.form_cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed" onClick={onSave}>
            {editingItem ? t('team.form_save_edit') : t('team.form_save_create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(TeamFormModal);
