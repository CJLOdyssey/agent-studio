import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Wrench, Server, Sparkles } from 'lucide-react';
import type { Agent, AgentTool, AgentMCP, AgentSkill } from '../../../types/AgentStudio';
import { useItemList } from '../../../hooks/useItemList';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useAgentConfigForm } from './tabs/useAgentConfigForm';
import { useConfigItemEdit } from './tabs/useConfigItemEdit';
import { usePickerState } from './tabs/usePickerState';
import TabRenderer from './tabs/TabRenderer';
import PickerSection from './PickerSection';

interface Props {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onClose: () => void;
}

const PRESET_TOOLS: Omit<AgentTool, 'enabled'>[] = [];
const PRESET_MCP: Omit<AgentMCP, 'enabled'>[] = [];
const PRESET_SKILLS: Omit<AgentSkill, 'enabled'>[] = [];

export default function AgentConfigModal({ agent, onSave, onClose }: Props) {
  const { t } = useTranslation();

  const TABS = [
    { key: 'system', label: t('workstation.prompt'), icon: null as React.ComponentType<{ size?: number }> | null },
    { key: 'output', label: t('workstation.output'), icon: null },
    { key: 'tools', label: t('workstation.tools'), icon: Wrench },
    { key: 'mcp', label: 'MCP', icon: Server },
    { key: 'skills', label: 'Skills', icon: Sparkles },
  ] as const;
  const modalRef = useRef<HTMLDivElement>(null);
  const systemRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      firstInput?.focus();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);

  const tools = useItemList<AgentTool>(PRESET_TOOLS.map((t) => ({ ...t, enabled: false })));
  const mcp = useItemList<AgentMCP>(PRESET_MCP.map((t) => ({ ...t, enabled: false })));
  const skills = useItemList<AgentSkill>(PRESET_SKILLS.map((t) => ({ ...t, enabled: false })));
  const form = useAgentConfigForm();

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
  const [outputConstraints, setOutputConstraints] = useState(agent.outputConstraints || '');
  useAutoSave('agentstudio:agent:systemPrompt', systemPrompt);
  useAutoSave('agentstudio:agent:outputConstraints', outputConstraints);
  const [activeTab, setActiveTab] = useState('system');
  const itemEdit = useConfigItemEdit(tools, mcp, skills, form);

  useEffect(() => {
    let cancelled = false;
    if (!cancelled) {
      if (agent.tools) tools.setItems(agent.tools);
      if (agent.mcp) mcp.setItems(agent.mcp);
      if (agent.skills) skills.setItems(agent.skills);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { pickerTab, pickerItems, handlePickerSelect, setPickerTab } = usePickerState({
    setSystemPrompt,
    setOutputConstraints,
    addTool: (item) => tools.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true, parameters: String((item as Record<string, unknown>).parameters ?? '') }) as AgentTool),
    addMcp: (item) => mcp.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true }) as AgentMCP),
    addSkill: (item) => skills.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true }) as AgentSkill),
  });

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...agent,
      name: name.trim(),
      role: role.trim(),
      systemPrompt,
      outputConstraints,
      tools: tools.items,
      mcp: mcp.items,
      skills: skills.items,
      isConfigured: true,
    });
  };

  const renderTabContent = () => (
    <TabRenderer
      activeTab={activeTab}
      systemRef={systemRef}
      outputRef={outputRef}
      systemPrompt={systemPrompt}
      onSystemPromptChange={setSystemPrompt}
      outputConstraints={outputConstraints}
      onOutputConstraintsChange={setOutputConstraints}
      tools={tools}
      mcp={mcp}
      skills={skills}
      form={form}
      editingToolItem={itemEdit.editingToolItem}
      editingMcpItem={itemEdit.editingMcpItem}
      editingSkillItem={itemEdit.editingSkillItem}
      onSaveFormItem={itemEdit.saveFormItem}
      onFormClose={itemEdit.handleFormClose}
      onSetEditingMcpItem={itemEdit.setEditingMcpItem}
      onSetEditingSkillItem={itemEdit.setEditingSkillItem}
      onEditTool={itemEdit.handleEditTool}
      onEditMcp={itemEdit.handleEditMcp}
      onEditSkill={itemEdit.handleEditSkill}
      onPickerOpen={setPickerTab}
      itemsToFormData={itemEdit.itemsToFormData}
    />
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content agent-config-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="agent-config-header">
            <div className={`agent-config-avatar ${agent.bg} ${agent.border}`}>
              <agent.icon size={20} className={agent.color} />
            </div>
            <div>
              <h3 className="agent-config-title">{t('workstation.agentManage')}</h3>
              <p className="agent-config-subtitle">
                设置 <strong>{agent.name}</strong> 的能力和行为
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="agent-config-fields">
          <div className="agent-config-field">
            <label className="form-label">{t('workstation.agentName')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="新 Agent" className="form-input" />
          </div>
          <div className="agent-config-field">
            <label className="form-label">{t('workstation.agentDesc')}</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="如：前端开发工程师、后端 API 设计师..." className="form-input" />
          </div>
          <p className="form-hint">{t('workstation.agentPlaceholder')}</p>
        </div>

        <div className="agent-config-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`agent-config-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon && <tab.icon size={14} />}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="agent-config-content" key={activeTab}>
          {renderTabContent()}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>{t('workstation.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>{t('workstation.saveConfig')}</button>
        </div>
      </div>

      <PickerSection tab={pickerTab} items={pickerItems} onSelect={handlePickerSelect} onClose={() => setPickerTab(null)} />
    </div>
  );
}
