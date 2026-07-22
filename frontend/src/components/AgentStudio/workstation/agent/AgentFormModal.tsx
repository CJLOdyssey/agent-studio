import { memo, useState, useCallback, useEffect } from 'react';
import { X, Bot } from 'lucide-react';
import type { AgentEntry, AgentFormData } from './agent.types';
import { useModelOptions } from '../constants';
import { listTeams } from '../../../../api/client/teams';
import { ResourcePickerSection } from './ResourcePickerSection';
import { t } from './locales';

/** Minimal reference shape — agent module owns its own reference interface. */
interface RefItem {
  id: string;
  name: string;
}

interface Props {
  editingAgent: AgentEntry | null;
  formData: AgentFormData;
  setFormData: (d: AgentFormData) => void;
  formErrors: string[];
  onSave: () => void;
  onClose: () => void;
  availablePrompts: RefItem[];
  availableTools: RefItem[];
  availableMCPs: RefItem[];
  availableSkills: RefItem[];
}

type PickerType = 'prompt' | 'tools' | 'mcp' | 'skills' | null;

function AgentFormModal({ editingAgent, formData, setFormData, onSave, onClose, availablePrompts, availableTools, availableMCPs, availableSkills }: Props) {
  const modelOptions = useModelOptions();
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Escape') onClose(); }, [onClose]);

  useEffect(() => {
    listTeams().then((items) => setTeamOptions(items.map((t) => t.name))).catch(() => {});
  }, []);

  const selectedPrompt = availablePrompts.find((p) => p.id === formData.systemPromptId);
  const selectedTools = availableTools.filter((t) => formData.toolIds.includes(t.id));
  const selectedMCPs = availableMCPs.filter((m) => formData.mcpIds.includes(m.id));
  const selectedSkills = availableSkills.filter((s) => formData.skillIds.includes(s.id));

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-content wsta-agent-form-modal" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-title">
            <Bot size={16} />
            {editingAgent ? t('agent.form_edit_title') : t('agent.form_create_title')}
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── Body ── */}
        <div className="modal-body">
          {/* ═══ Section: Basic Info ═══ */}
          <div className="wsta-form-section">
            <div className="wsta-form-section-title">
              <Bot size={14} />
              {t('agent.form_section_basic')}
            </div>

            <div className="wsta-form-group">
              <label className="wsta-label">{t('agent.form_name')} <span className="wsta-required">*</span></label>
              <input className="wsta-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('agent.form_name_placeholder')} maxLength={30} />
            </div>
            <div className="wsta-form-group" style={{ marginTop: 14 }}>
              <label className="wsta-label">{t('agent.form_desc')}</label>
              <textarea className="wsta-textarea" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder={t('agent.form_desc_placeholder')} rows={2} maxLength={200} />
            </div>
            <div className="wsta-form-row" style={{ marginTop: 14 }}>
              <div className="wsta-form-group">
                <label className="wsta-label">{t('agent.form_team')}</label>
                <select className="wsta-select" value={formData.team} onChange={(e) => setFormData({ ...formData, team: e.target.value })}>
                  <option value="">—</option>
                  {teamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="wsta-form-group">
                <label className="wsta-label">{t('agent.form_model')}</label>
                <select className="wsta-select" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })}>
                  {modelOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="wsta-form-group" style={{ maxWidth: 140 }}>
                <label className="wsta-label">{t('agent.form_version')}</label>
                <input className="wsta-input" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} placeholder={t('agent.form_version_placeholder')} />
              </div>
            </div>
          </div>

          <ResourcePickerSection
            formData={formData}
            setFormData={setFormData}
            activePicker={activePicker}
            setActivePicker={setActivePicker}
            selectedPrompt={selectedPrompt}
            selectedTools={selectedTools}
            selectedMCPs={selectedMCPs}
            selectedSkills={selectedSkills}
            availablePrompts={availablePrompts}
            availableTools={availableTools}
            availableMCPs={availableMCPs}
            availableSkills={availableSkills}
          />
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('agent.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>
            {editingAgent ? t('agent.form_save_edit') : t('agent.form_save_create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(AgentFormModal);
