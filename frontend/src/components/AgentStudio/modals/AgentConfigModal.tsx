import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { X, Wrench, Server, Sparkles } from 'lucide-react';
import type { Agent, AgentTool, AgentMCP, AgentSkill } from '../../../types/AgentStudio';

function toRec<T>(v: Record<string, unknown>): T {
  return v as unknown as T;
}
import { useItemList } from '../../../hooks/useItemList';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useAgentConfigForm } from './tabs/useAgentConfigForm';
import { usePickerState } from './tabs/usePickerState';
import TabRenderer from './tabs/TabRenderer';
import PickerSection from './PickerSection';
import type { ToolFormData } from '../workstation/tool/tool.types';
import { toolAPI } from '../workstation/tool/api';

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
  const [editingToolItem, setEditingToolItem] = useState<AgentTool | null>(null);
  const [editingMcpItem, setEditingMcpItem] = useState<AgentMCP | null>(null);
  const [editingSkillItem, setEditingSkillItem] = useState<AgentSkill | null>(null);

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

  function saveFormItem(kind: 'tool' | 'mcp' | 'skill') {
    const f = form.forms[kind];
    if (!('name' in f.data) || !(f.data as { name: string }).name.trim()) {
      form.setFormErrors(kind, [t('workstation.nameRequired')]);
      return;
    }
    const data = f.data as Record<string, string>;
    switch (kind) {
      case 'tool':
        if (editingToolItem) {
          tools.update(editingToolItem.id, { name: data.name, description: data.description || '', parameters: data.parameters || '' } as Partial<AgentTool>);
          setEditingToolItem(null);
        } else {
          const id = `custom-${Date.now()}`;
          tools.addCustom(() => ({ id, name: data.name, description: data.description || '', enabled: true, parameters: data.parameters || '' }) as AgentTool);
          toolAPI.create({ name: data.name, description: data.description || '', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: data.endpoint || '', parameters: data.parameters || '' }).catch(() => {});
        }
        break;
      case 'mcp':
        if (editingMcpItem) {
          mcp.update(editingMcpItem.id, { name: data.name, description: data.description || '' } as Partial<AgentMCP>);
          setEditingMcpItem(null);
        } else {
          mcp.addCustom(() => ({ id: `custom-${Date.now()}`, name: data.name, description: data.description || '', enabled: true }) as AgentMCP);
        }
        break;
      case 'skill':
        if (editingSkillItem) {
          skills.update(editingSkillItem.id, { name: data.name, description: data.description || '' } as Partial<AgentSkill>);
          setEditingSkillItem(null);
        } else {
          skills.addCustom(() => ({ id: `custom-${Date.now()}`, name: data.name, description: data.description || '', enabled: true }) as AgentSkill);
        }
        break;
    }
    form.closeForm(kind);
  }

  function itemsToFormData(item: Record<string, unknown>): ToolFormData {
    return {
      name: item.name as string || '',
      description: (item.description as string) || '',
      category: (item.category as string) || '自定义工具',
      model: (item.model as string) || 'GPT-4o',
      status: 'active',
      version: (item.version as string) || 'v1.0.0',
      endpoint: (item.endpoint as string) || '',
      parameters: (item.parameters as string) || '{"type":"object"}',
    };
  }

  function handleFormClose() {
    form.closeForm('tool');
    setEditingToolItem(null);
    setEditingMcpItem(null);
    setEditingSkillItem(null);
  }

  function handleEditTool(item: Record<string, unknown>) {
    const tool = itemsToFormData(item);
    setEditingToolItem(toRec<AgentTool>(item));
    form.openForm('tool');
    form.updateFormData('tool', () => tool);
  }

  function handleEditMcp(item: Record<string, unknown>) {
    setEditingMcpItem(toRec<AgentMCP>(item));
    form.openForm('mcp');
    form.updateFormData('mcp', () => ({
      name: item.name as string || '',
      description: (item.description as string) || '',
      type: (item.type as string) || 'stdio',
      status: (item.status as string) || 'disconnected',
      version: (item.version as string) || 'v1.0.0',
      command: (item.command as string) || '',
      url: (item.url as string) || '',
    }));
  }

  function handleEditSkill(item: Record<string, unknown>) {
    setEditingSkillItem(toRec<AgentSkill>(item));
    form.openForm('skill');
    form.updateFormData('skill', () => ({
      name: item.name as string || '',
      description: (item.description as string) || '',
      category: (item.category as string) || 'AI/ML',
      status: (item.status as string) || 'available',
      version: (item.version as string) || 'v1.0.0',
      author: (item.author as string) || '',
      instructions: (item.instructions as string) || '',
      prompt_id: (item.prompt_id as string) || '',
      tool_names: (item.tool_names as string[]) || [],
      output_constraint: (item.output_constraint as string) || '',
    }));
  }

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
      editingToolItem={editingToolItem}
      editingMcpItem={editingMcpItem}
      editingSkillItem={editingSkillItem}
      onSaveFormItem={saveFormItem}
      onFormClose={handleFormClose}
      onSetEditingMcpItem={setEditingMcpItem}
      onSetEditingSkillItem={setEditingSkillItem}
      onEditTool={handleEditTool}
      onEditMcp={handleEditMcp}
      onEditSkill={handleEditSkill}
      onPickerOpen={setPickerTab}
      itemsToFormData={itemsToFormData}
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
