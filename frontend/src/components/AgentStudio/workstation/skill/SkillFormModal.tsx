import { memo, useCallback, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { SkillEntry, SkillFormData } from './skill.types';
import { SKILL_CATEGORIES, SKILL_STATUS_LABEL } from './skill.constants';
import { t } from './locales';

interface CompositionOption {
  id: string;
  name: string;
}

interface Props {
  editingSkill: SkillEntry | null;
  formData: SkillFormData;
  setFormData: (fn: (f: SkillFormData) => SkillFormData) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
}

function SkillFormModal({ editingSkill, formData, setFormData, onSave, onClose, errors }: Props) {
  const [prompts, setPrompts] = useState<CompositionOption[]>([]);
  const [tools, setTools] = useState<CompositionOption[]>([]);
  const [mcps, setMcps] = useState<CompositionOption[]>([]);
  const [constraints, setConstraints] = useState<CompositionOption[]>([]);

  useEffect(() => {
    fetch('/api/prompts').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setPrompts(d.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
    }).catch(() => {});
    fetch('/api/tools').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setTools(d.map((t: { id: string; name: string }) => ({ id: t.name, name: t.name })));
    }).catch(() => {});
    fetch('/api/mcps').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setMcps(d.map((m: { id: string; name: string }) => ({ id: m.name, name: m.name })));
    }).catch(() => {});
    fetch('/api/prompts?category=output_constraint').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setConstraints(d.map((c: { id: string; name: string; content: string }) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
  }, []);

  const allTools = [...tools, ...mcps];

  const toggleTool = useCallback((name: string) => {
    setFormData(f => ({
      ...f,
      tool_names: f.tool_names.includes(name)
        ? f.tool_names.filter(n => n !== name)
        : [...f.tool_names, name],
    }));
  }, [setFormData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  const noPromptLabel = `-- ${t('skill.form_no_prompt')} --`;
  const noPromptId = '__none__';

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-content wsta-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h3>{editingSkill ? t('skill.form_title_edit') : t('skill.form_title_new')}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body wsta-modal-body">
          {errors.length > 0 && (
            <div className="wsta-form-errors">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          <div className="wsta-form-group">
            <label className="wsta-label">{t('skill.form_name')} <span className="wsta-required">*</span></label>
            <input className="wsta-input" value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('skill.form_name_placeholder')} maxLength={50} />
          </div>

          <div className="wsta-form-group">
            <label className="wsta-label">{t('skill.form_desc')}</label>
            <textarea className="wsta-textarea" value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('skill.form_desc_placeholder')} rows={2} maxLength={500} />
          </div>

          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('skill.form_category')}</label>
              <select className="wsta-select" value={formData.category}
                onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('skill.form_status')}</label>
              <select className="wsta-select" value={formData.status}
                onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value as SkillEntry['status'] }))}>
                {Object.entries(SKILL_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="wsta-form-row">
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('skill.form_version')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.version}
                onChange={(e) => setFormData((f) => ({ ...f, version: e.target.value }))}
                placeholder={t('skill.form_version_placeholder')} />
            </div>
            <div className="wsta-form-group wsta-flex-1">
              <label className="wsta-label">{t('skill.form_author')}</label>
              <input className="wsta-input" value={formData.author}
                onChange={(e) => setFormData((f) => ({ ...f, author: e.target.value }))}
                placeholder={t('skill.form_author_placeholder')} />
            </div>
          </div>

          <div className="wsta-form-group">
            <label className="wsta-label">{t('skill.form_prompt')}</label>
            <select className="wsta-select" value={formData.prompt_id || noPromptId}
              onChange={(e) => setFormData(f => ({ ...f, prompt_id: e.target.value === noPromptId ? '' : e.target.value }))}>
              <option value={noPromptId}>{noPromptLabel}</option>
              {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="wsta-form-group">
            <label className="wsta-label">{t('skill.form_tools')}</label>
            <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px' }}>
              {allTools.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('skill.form_no_tools')}</span>}
              {allTools.map(t => (
                <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.tool_names.includes(t.name)} onChange={() => toggleTool(t.name)} />
                  {t.name}
                </label>
              ))}
            </div>
          </div>

          <div className="wsta-form-group">
            <label className="wsta-label">{t('skill.form_output_constraint')}</label>
            <select className="wsta-select" value=""
              onChange={(e) => {
                if (e.target.value) setFormData(f => ({ ...f, output_constraint: f.output_constraint + (f.output_constraint ? '\n' : '') + e.target.value }));
              }}>
              <option value="">{t('skill.form_pick_constraint')}</option>
              {constraints.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <textarea className="wsta-textarea" value={formData.output_constraint}
              onChange={(e) => setFormData((f) => ({ ...f, output_constraint: e.target.value }))}
              placeholder={t('skill.form_output_constraint_placeholder')} rows={2} maxLength={500}
              style={{ marginTop: 6 }} />
          </div>

          <div className="wsta-form-group">
            <label className="wsta-label">{t('skill.form_instructions')}</label>
            <textarea className="wsta-textarea" value={formData.instructions}
              onChange={(e) => setFormData((f) => ({ ...f, instructions: e.target.value }))}
              placeholder={t('skill.form_instructions_placeholder')} rows={4} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('skill.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>{editingSkill ? t('skill.form_save_edit') : t('skill.form_save_create')}</button>
        </div>
      </div>
    </div>
  );
}

export default memo(SkillFormModal);
