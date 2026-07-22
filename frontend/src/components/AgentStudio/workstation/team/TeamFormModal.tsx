import { memo, useCallback } from 'react';
import { X, Users, Bot } from 'lucide-react';
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
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-content wsta-modal wsta-modal-sm team-form-animate" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="team-form-avatar"><Users size={20} /></div>
            <div>
              <h3 style={{ margin: 0 }}>{editingItem ? t('team.form_title_edit') : t('team.form_title_new')}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)' }}>
                {editingItem ? editingItem.name : ''}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {errors.length > 0 && <div className="wsta-form-errors">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}

          <div className="wsta-form-section">
            <div className="wsta-form-section-title"><Bot size={14} />基本信息</div>
            <div className="wsta-form-group">
              <label className="wsta-label">{t('team.form_name')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('team.form_name_placeholder')} maxLength={50} autoFocus />
            </div>
            <div className="wsta-form-group" style={{ marginTop: 14 }}>
              <label className="wsta-label">{t('team.form_desc')}</label>
              <textarea className="wsta-textarea" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('team.form_desc_placeholder')} rows={3} />
            </div>
            <div className="wsta-form-row" style={{ marginTop: 14 }}>
              <div className="wsta-form-group">
                <label className="wsta-label">{t('team.form_category')}</label>
                <select className="wsta-select" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value as TeamFormData['category'] }))}>
                  {CATEGORY_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>))}
                </select>
              </div>
              <div className="wsta-form-group">
                <label className="wsta-label">{t('team.form_status')}</label>
                <select className="wsta-select" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}>
                  <option value="active">{t('team.status_active')}</option>
                  <option value="inactive">{t('team.status_inactive')}</option>
                </select>
              </div>
            </div>
          </div>


        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('team.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>
            {editingItem ? t('team.form_save_edit') : t('team.form_save_create')}
          </button>
        </div>
      </div>

          </div>
  );
}

export default memo(TeamFormModal);
