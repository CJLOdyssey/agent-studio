/** Resource picker bindings section for AgentFormModal. */
import { type ReactNode } from 'react';
import { Bot, MessageSquareText, Wrench, Server, Puzzle, ChevronRight } from 'lucide-react';
import type { AgentFormData } from './agent.types';
import { t } from './locales';
import ResourcePickerModal from '../shared/ResourcePickerModal';

interface RefItem { id: string; name: string; }
type PickerType = 'prompt' | 'tools' | 'mcp' | 'skills' | null;

const pickerConfig: Record<string, { icon: typeof Bot; labelKey: string; titleKey: string; multiple: boolean }> = {
  prompt: { icon: MessageSquareText, labelKey: 'agent.form_prompt_select', titleKey: 'agent.form_prompt_select', multiple: false },
  tools:  { icon: Wrench,           labelKey: 'agent.form_tool_select',  titleKey: 'agent.form_tool_select',  multiple: true },
  mcp:    { icon: Server,           labelKey: 'agent.form_mcp_select',   titleKey: 'agent.form_mcp_select',   multiple: true },
  skills: { icon: Puzzle,           labelKey: 'agent.form_skill_select', titleKey: 'agent.form_skill_select', multiple: true },
};

interface Props {
  formData: AgentFormData;
  setFormData: (d: AgentFormData) => void;
  activePicker: PickerType;
  setActivePicker: (v: PickerType) => void;
  selectedPrompt?: RefItem;
  selectedTools: RefItem[];
  selectedMCPs: RefItem[];
  selectedSkills: RefItem[];
  availablePrompts: RefItem[];
  availableTools: RefItem[];
  availableMCPs: RefItem[];
  availableSkills: RefItem[];
}

function renderSelectedChips(items: RefItem[], onRemove: (id: string) => void) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map((item) => (
        <span key={item.id} className="wsta-picker-chip">
          {item.name}
          <button className="wsta-picker-chip-remove" onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}>&times;</button>
        </span>
      ))}
    </div>
  );
}

function getResourcePicker(
  pickerType: PickerType,
  formData: AgentFormData,
  setFormData: (d: AgentFormData) => void,
  setActivePicker: (v: PickerType) => void,
  availablePrompts: RefItem[],
  availableTools: RefItem[],
  availableMCPs: RefItem[],
  availableSkills: RefItem[],
): ReactNode {
  if (!pickerType) return null;
  const cfg = pickerConfig[pickerType];
  if (!cfg) return null;
  const Icon = cfg.icon;

  let options: RefItem[];
  let selectedIds: string[];
  switch (pickerType) {
    case 'prompt':
      options = availablePrompts;
      selectedIds = formData.systemPromptId ? [formData.systemPromptId] : [];
      break;
    case 'tools':
      options = availableTools;
      selectedIds = formData.toolIds;
      break;
    case 'mcp':
      options = availableMCPs;
      selectedIds = formData.mcpIds;
      break;
    case 'skills':
      options = availableSkills;
      selectedIds = formData.skillIds;
      break;
    default:
      return null;
  }

  const handleConfirm = (ids: string | string[]) => {
    if (pickerType === 'prompt') {
      setFormData({ ...formData, systemPromptId: ids as string });
    } else {
      setFormData({ ...formData, [`${pickerType}Ids`]: ids });
    }
    setActivePicker(null);
  };

  return (
    <ResourcePickerModal
      icon={<Icon size={16} />}
      title={t(cfg.titleKey)}
      options={options}
      selectedIds={selectedIds}
      multiple={cfg.multiple}
      onConfirm={handleConfirm}
      onClose={() => setActivePicker(null)}
    />
  );
}

export function ResourcePickerSection({
  formData, setFormData, activePicker, setActivePicker,
  selectedPrompt, selectedTools, selectedMCPs, selectedSkills,
  availablePrompts, availableTools, availableMCPs, availableSkills,
}: Props) {
  return (
    <>
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

      {getResourcePicker(activePicker, formData, setFormData, setActivePicker, availablePrompts, availableTools, availableMCPs, availableSkills)}
    </>
  );
}
