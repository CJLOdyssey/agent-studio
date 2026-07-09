import { memo, useState, useCallback, useEffect } from 'react';
import { X, Bot, MessageSquareText, Wrench, Server, Puzzle, ChevronRight } from 'lucide-react';
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

const pickerConfig: Record<string, { icon: typeof Bot; labelKey: string; titleKey: string; multiple: boolean }> = {
  prompt: { icon: MessageSquareText, labelKey: 'agent.form_prompt_select', titleKey: 'agent.form_prompt_select', multiple: false },
  tools:  { icon: Wrench,           labelKey: 'agent.form_tool_select',  titleKey: 'agent.form_tool_select',  multiple: true },
  mcp:    { icon: Server,           labelKey: 'agent.form_mcp_select',   titleKey: 'agent.form_mcp_select',   multiple: true },
  skills: { icon: Puzzle,           labelKey: 'agent.form_skill_select', titleKey: 'agent.form_skill_select', multiple: true },
};

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

  function getResourcePicker(pickerType: PickerType) {
    if (!pickerType) return null;
    const cfg = pickerConfig[pickerType];
    if (!cfg) return null;

    let options: RefItem[];
    let selectedIds: string | string[];
    let onConfirm: (ids: string | string[]) => void;

    switch (pickerType) {
      case 'prompt':
        options = availablePrompts;
        selectedIds = formData.systemPromptId;
        onConfirm = (ids) => { setFormData({ ...formData, systemPromptId: ids as string }); setActivePicker(null); };
        break;
      case 'tools':
        options = availableTools;
        selectedIds = formData.toolIds;
        onConfirm = (ids) => { setFormData({ ...formData, toolIds: ids as string[] }); setActivePicker(null); };
        break;
      case 'mcp':
        options = availableMCPs;
        selectedIds = formData.mcpIds;
        onConfirm = (ids) => { setFormData({ ...formData, mcpIds: ids as string[] }); setActivePicker(null); };
        break;
      case 'skills':
        options = availableSkills;
        selectedIds = formData.skillIds;
        onConfirm = (ids) => { setFormData({ ...formData, skillIds: ids as string[] }); setActivePicker(null); };
        break;
      default:
        return null;
    }

    return (
      <ResourcePickerModal
        title={t(cfg.titleKey)}
        options={options}
        selectedIds={selectedIds}
        onConfirm={onConfirm}
        onClose={() => setActivePicker(null)}
        getOptionId={(p) => p.id}
        getOptionLabel={(p) => p.name}
        multiple={cfg.multiple}
      />
    );
  }

  function renderSelectedChips(
    items: { id: string; name: string }[],
    onRemove?: (id: string) => void
  ) {
    if (items.length === 0) return null;
    return (
      <div className="wsta-chip-group">
        {items.map((item) => (
          <span key={item.id} className="wsta-chip">
            {item.name}
            {onRemove && (
              <button className="wsta-chip-remove" onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} aria-label="remove">
                <X size={12} />
              </button>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal-content wsta-modal agent-form-animate" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="agent-form-avatar">
              <Bot size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{editingAgent ? t('agent.form_title_edit') : t('agent.form_title_new')}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)' }}>
                {editingAgent ? editingAgent.name : ''}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {formErrors.length > 0 && (
            <div className="wsta-form-errors">
              {formErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

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

          {/* ═══ Section: Resource Bindings ═══ */}
          <div className="wsta-form-section">
            <div className="wsta-form-section-title">
              <Puzzle size={14} />
              {t('agent.form_section_bindings')}
            </div>

            <div className="wsta-resource-grid">
              {/* Prompt */}
              <div className="wsta-form-group">
                <label className="wsta-label">{t('agent.form_prompt')} <span className="wsta-required">*</span></label>
                <div className="wsta-picker-trigger" onClick={() => setActivePicker('prompt')}>
                  {selectedPrompt ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquareText size={14} /> {selectedPrompt.name}
                    </span>
                  ) : (
                    <span className="placeholder" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquareText size={14} /> {t('agent.form_prompt_empty')}
                    </span>
                  )}
                  <ChevronRight size={14} />
                </div>
              </div>

              {/* Tools */}
              <div className="wsta-form-group">
                <label className="wsta-label">{t('agent.form_tools')} ({selectedTools.length})</label>
                <div className="wsta-picker-trigger" onClick={() => setActivePicker('tools')}>
                  {selectedTools.length > 0 ? (
                    <div className="wsta-picker-trigger-tags">
                      {renderSelectedChips(selectedTools, (id) => setFormData({ ...formData, toolIds: formData.toolIds.filter((tid) => tid !== id) }))}
                    </div>
                  ) : (
                    <span className="placeholder" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Wrench size={14} /> {t('agent.form_tool_select')}</span>
                  )}
                  <ChevronRight size={14} />
                </div>
              </div>

              {/* MCP */}
              <div className="wsta-form-group">
                <label className="wsta-label">{t('agent.form_mcp')} ({selectedMCPs.length})</label>
                <div className="wsta-picker-trigger" onClick={() => setActivePicker('mcp')}>
                  {selectedMCPs.length > 0 ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renderSelectedChips(selectedMCPs, (id) => setFormData({ ...formData, mcpIds: formData.mcpIds.filter((mid) => mid !== id) }))}
                    </div>
                  ) : (
                    <span className="placeholder"><Server size={14} /> {t('agent.form_mcp_select')}</span>
                  )}
                  <ChevronRight size={14} />
                </div>
              </div>

              {/* Skills */}
              <div className="wsta-form-group">
                <label className="wsta-label">{t('agent.form_skills')} ({selectedSkills.length})</label>
                <div className="wsta-picker-trigger" onClick={() => setActivePicker('skills')}>
                  {selectedSkills.length > 0 ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renderSelectedChips(selectedSkills, (id) => setFormData({ ...formData, skillIds: formData.skillIds.filter((sid) => sid !== id) }))}
                    </div>
                  ) : (
                    <span className="placeholder"><Puzzle size={14} /> {t('agent.form_skill_select')}</span>
                  )}
                  <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('agent.form_cancel')}</button>
          <button className="btn btn-primary" onClick={onSave}>
            {editingAgent ? t('agent.form_save_edit') : t('agent.form_save_create')}
          </button>
        </div>
      </div>

      {getResourcePicker(activePicker)}
    </div>
  );
}

export default memo(AgentFormModal);
