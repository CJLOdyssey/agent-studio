import { memo, useCallback } from 'react';
import { X } from 'lucide-react';
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

function TeamFormModal({ editingItem, formData, setFormData, onSave, onClose, errors }: Props) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);

  return (
    <div className="wsta-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="wsta-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wsta-modal-header">
          <h3 className="wsta-modal-title">{editingItem ? t('team.form_title_edit') : t('team.form_title_new')}</h3>
          <button className="wsta-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="wsta-modal-body">
          {errors.length > 0 && <div className="wsta-form-errors">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
          <div className="wsta-form-grid">
            <div className="wsta-form-group wsta-form-group-full">
              <label className="wsta-label">{t('team.form_name')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder={t('team.form_name_placeholder')} />
            </div>
            <div className="wsta-form-group wsta-form-group-full">
              <label className="wsta-label">{t('team.form_desc')}</label>
              <textarea className="wsta-input wsta-textarea" value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} placeholder={t('team.form_desc_placeholder')} rows={3} />
            </div>
            <div className="wsta-form-group">
              <label className="wsta-label">{t('team.form_leader')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.leader} onChange={(e) => setFormData((f) => ({ ...f, leader: e.target.value }))} placeholder={t('team.form_leader_placeholder')} />
            </div>
            <div className="wsta-form-group">
              <label className="wsta-label">{t('team.form_members')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" type="number" min={1} value={formData.memberCount} onChange={(e) => setFormData((f) => ({ ...f, memberCount: Math.max(1, parseInt(e.target.value) || 1) }))} />
            </div>
            <div className="wsta-form-group">
              <label className="wsta-label">{t('team.col_status')}</label>
              <select className="wsta-select" value={formData.status} onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as TeamEntry['status'] }))}>
                <option value="active">{t('team.status_active')}</option>
                <option value="inactive">{t('team.status_inactive')}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="wsta-modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('team.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>{editingItem ? t('team.form_save_edit') : t('team.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
}

export default memo(TeamFormModal);
