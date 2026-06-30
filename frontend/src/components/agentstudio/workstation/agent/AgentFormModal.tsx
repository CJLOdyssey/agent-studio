import { memo, useState, useCallback, useEffect } from 'react';
import { X, MessageSquareText, Wrench, Server, Puzzle, ChevronRight } from 'lucide-react';
import type { AgentEntry, AgentFormData } from './agent.types';
import { useModelOptions } from '../constants';
import { listTeams } from '../../../../api/client/teams';
import ResourcePickerModal from '../shared/ResourcePickerModal';
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

function AgentFormModal({ editingAgent, formData, setFormData, formErrors, onSave, onClose, availablePrompts, availableTools, availableMCPs, availableSkills }: Props) {
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
      <div className="modal-content wsta-modal wsta-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editingAgent ? t('agent.form_title_edit') : t('agent.form_title_new')}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {formErrors.length > 0 && <div className="wsta-form-errors">{formErrors.map((e, i) => <p key={i}>{e}</p>)}</div>}

          <div className="wsta-form-group">
            <label className="wsta-label">{t('agent.form_name')} <span className="wsta-required">*</span></label>
            <input className="wsta-input" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('agent.form_name_placeholder')} maxLength={30} />
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('agent.form_desc')}</label>
            <textarea className="wsta-textarea" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="描述..." rows={2} maxLength={200} />
          </div>
          <div className="wsta-form-row">
            <div className="wsta-form-group">
              <label className="wsta-label">{t('agent.form_team')}</label>
              <select className="wsta-select" value={formData.team} onChange={(e) => setFormData({ ...formData, team: e.target.value })}>
                {teamOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="wsta-form-group">
              <label className="wsta-label">{t('agent.form_model')}</label>
              <select className="wsta-select" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })}>
                {modelOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('agent.form_version')}</label>
            <input className="wsta-input" value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} placeholder={t('agent.form_version_placeholder')} />
          </div>

          <div className="wsta-form-group">
            <label className="wsta-label">{t('agent.form_prompt')} <span className="wsta-required">*</span></label>
            <div className="wsta-picker-field" onClick={() => setActivePicker('prompt')}>
              {selectedPrompt ? (
                <span className="wsta-picker-selected">
                  <MessageSquareText size={14} /> {selectedPrompt.name}
                </span>
              ) : <span className="wsta-picker-empty">{t('agent.form_prompt_empty')}</span>}
              <ChevronRight size={14} />
            </div>
          </div>

          <div className="wsta-form-row">
            <div className="wsta-form-group">
              <label className="wsta-label">{t('agent.form_tools')} ({selectedTools.length})</label>
              <div className="wsta-picker-field" onClick={() => setActivePicker('tools')}>
                <span className="wsta-picker-selected"><Wrench size={14} /> {selectedTools.length} 个工具</span>
                <ChevronRight size={14} />
              </div>
            </div>
            <div className="wsta-form-group">
              <label className="wsta-label">{t('agent.form_mcp')} ({selectedMCPs.length})</label>
              <div className="wsta-picker-field" onClick={() => setActivePicker('mcp')}>
                <span className="wsta-picker-selected"><Server size={14} /> {selectedMCPs.length} 个 MCP</span>
                <ChevronRight size={14} />
              </div>
            </div>
          </div>
          <div className="wsta-form-group">
            <label className="wsta-label">{t('agent.form_skills')} ({selectedSkills.length})</label>
            <div className="wsta-picker-field" onClick={() => setActivePicker('skills')}>
              <span className="wsta-picker-selected"><Puzzle size={14} /> {selectedSkills.length} 个 Skills</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('agent.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>{editingAgent ? t('agent.form_save_edit') : t('agent.form_save_create')}</button>
        </div>
      </div>

      {activePicker === 'prompt' && (
        <ResourcePickerModal title="选择提示词" options={availablePrompts} selectedIds={formData.systemPromptId} onConfirm={(ids: string | string[]) => { setFormData({ ...formData, systemPromptId: ids as string }); setActivePicker(null); }} onClose={() => setActivePicker(null)} getOptionId={(p) => p.id} getOptionLabel={(p) => p.name} />
      )}
      {activePicker === 'tools' && (
        <ResourcePickerModal title="选择工具" options={availableTools} selectedIds={formData.toolIds} onConfirm={(ids: string | string[]) => { setFormData({ ...formData, toolIds: ids as string[] }); setActivePicker(null); }} onClose={() => setActivePicker(null)} getOptionId={(t) => t.id} getOptionLabel={(t) => t.name} multiple />
      )}
      {activePicker === 'mcp' && (
        <ResourcePickerModal title="选择 MCP" options={availableMCPs} selectedIds={formData.mcpIds} onConfirm={(ids: string | string[]) => { setFormData({ ...formData, mcpIds: ids as string[] }); setActivePicker(null); }} onClose={() => setActivePicker(null)} getOptionId={(m) => m.id} getOptionLabel={(m) => m.name} multiple />
      )}
      {activePicker === 'skills' && (
        <ResourcePickerModal title="选择 Skills" options={availableSkills} selectedIds={formData.skillIds} onConfirm={(ids: string | string[]) => { setFormData({ ...formData, skillIds: ids as string[] }); setActivePicker(null); }} onClose={() => setActivePicker(null)} getOptionId={(s) => s.id} getOptionLabel={(s) => s.name} multiple />
      )}
    </div>
  );
}

export default memo(AgentFormModal);
