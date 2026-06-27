import { useState, useEffect, useRef } from 'react';
import { X, Wrench, Server, Sparkles } from 'lucide-react';
import type { Agent, AgentTool, AgentMCP, AgentSkill } from '../../../types/devagents';
import { useItemList } from '../../../hooks/useItemList';
import { SystemPromptTab } from './tabs/SystemPromptTab';
import { OutputConstraintTab } from './tabs/OutputConstraintTab';
import { ToolsTab } from './tabs/ToolsTab';
import { MCPTab } from './tabs/MCPTab';
import { SkillsTab } from './tabs/SkillsTab';
import { useAgentConfigForm } from './tabs/useAgentConfigForm';
import PickerModal from './PickerModal';
import type { PickerItem } from './PickerModal';
import type { ToolFormData } from '../workstation/tool/tool.types';
import { promptAPI } from '../workstation/prompt/api';
import { outputAPI } from '../workstation/output/api';
import { toolAPI } from '../workstation/tool/api';
import { mcpAPI } from '../workstation/mcp/api';
import { skillAPI } from '../workstation/skill/api';

interface Props {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onClose: () => void;
}

const PRESET_TOOLS: Omit<AgentTool, 'enabled'>[] = [];
const PRESET_MCP: Omit<AgentMCP, 'enabled'>[] = [];
const PRESET_SKILLS: Omit<AgentSkill, 'enabled'>[] = [];

const TABS = [
  { key: 'system', label: '提示词', icon: null },
  { key: 'output', label: '约束', icon: null },
  { key: 'tools', label: '工具', icon: Wrench },
  { key: 'mcp', label: 'MCP', icon: Server },
  { key: 'skills', label: 'Skills', icon: Sparkles },
] as const;

export default function AgentConfigModal({ agent, onSave, onClose }: Props) {
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
  const [activeTab, setActiveTab] = useState('system');
  const [pickerTab, setPickerTab] = useState<string | null>(null);
  const [pickerItems, setPickerItems] = useState<Record<string, PickerItem[]>>({});
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

  useEffect(() => {
    let cancelled = false;
    promptAPI.fetchAll().then(items => {
      if (!cancelled) setPickerItems(prev => ({...prev, system: items.map(p => ({ id: p.id, name: p.name, description: p.content.length > 120 ? p.content.slice(0, 120) + '…' : p.content, source: '提示词管理' } as PickerItem))}));
    }).catch(() => {});
    outputAPI.fetchAll().then(items => {
      if (!cancelled) setPickerItems(prev => ({...prev, output: items.map(o => ({ id: o.id, name: o.name, description: o.content, source: '输出约束' } as PickerItem))}));
    }).catch(() => {});
    toolAPI.fetchAll().then(items => {
      if (!cancelled) setPickerItems(prev => ({...prev, tools: items.map(t => ({id: t.id, name: t.name, description: t.description || '', source: '工具管理'}))}));
    }).catch(e => console.error('AgentConfigModal: tool fetch failed', e));
    mcpAPI.fetchAll().then(items => {
      if (!cancelled) setPickerItems(prev => ({...prev, mcp: items.map(m => ({id: m.id, name: m.name, description: m.description || '', source: 'MCP管理'}))}));
    }).catch(e => console.error('AgentConfigModal: mcp fetch failed', e));
    skillAPI.fetchAll().then(items => {
      if (!cancelled) setPickerItems(prev => ({...prev, skills: items.map(s => ({id: s.id, name: s.name, description: s.description || '', source: 'Skills管理'}))}));
    }).catch(e => console.error('AgentConfigModal: skill fetch failed', e));
    return () => { cancelled = true; };
  }, []);

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

  function handlePickerSelect(item: PickerItem) {
    switch (pickerTab) {
      case 'system':
        setSystemPrompt((prev) => prev + (prev ? '\n\n' : '') + item.description);
        break;
      case 'output':
        setOutputConstraints((prev) => prev + (prev ? '\n' : '') + item.description);
        break;
      case 'tools':
        tools.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true, parameters: (item as any).parameters || '' }) as AgentTool);
        break;
      case 'mcp':
        mcp.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true }) as AgentMCP);
        break;
      case 'skills':
        skills.addCustom(() => ({ id: item.id, name: item.name, description: item.description, enabled: true }) as AgentSkill);
        break;
    }
    setPickerTab(null);
  }

  function saveFormItem(kind: 'tool' | 'mcp' | 'skill') {
    const f = form.forms[kind];
    if (!('name' in f.data) || !(f.data as { name: string }).name.trim()) {
      form.setFormErrors(kind, ['名称不能为空']);
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

  function itemsToFormData(item: { id: string; name: string; description?: string } & Record<string, unknown>): ToolFormData {
    return {
      name: item.name,
      description: (item.description as string) || '',
      category: (item as any).category || '自定义工具',
      model: (item as any).model || 'GPT-4o',
      status: 'active',
      version: (item as any).version || 'v1.0.0',
      endpoint: (item as any).endpoint || '',
      parameters: (item as any).parameters || '{"type":"object"}',
    };
  }

  function handleFormClose() {
    form.closeForm('tool');
    setEditingToolItem(null);
    setEditingMcpItem(null);
    setEditingSkillItem(null);
  }

  function handleEditTool(item: { id: string; name: string; description?: string; enabled: boolean } & Record<string, unknown>) {
    const tool = itemsToFormData(item);
    setEditingToolItem(item as AgentTool);
    form.openForm('tool');
    form.updateFormData('tool', () => tool);
  }

  function handleEditMcp(item: { id: string; name: string; description?: string; enabled: boolean } & Record<string, unknown>) {
    setEditingMcpItem(item as unknown as AgentMCP);
    form.openForm('mcp');
    form.updateFormData('mcp', () => ({
      name: item.name,
      description: (item.description as string) || '',
      type: (item as any).type || 'stdio',
      status: (item as any).status || 'disconnected',
      version: (item as any).version || 'v1.0.0',
      command: (item as any).command || '',
      url: (item as any).url || '',
    }));
  }

  function handleEditSkill(item: { id: string; name: string; description?: string; enabled: boolean } & Record<string, unknown>) {
    setEditingSkillItem(item as AgentSkill);
    form.openForm('skill');
    form.updateFormData('skill', () => ({
      name: item.name,
      description: (item.description as string) || '',
      category: (item as any).category || 'AI/ML',
      status: (item as any).status || 'available',
      version: (item as any).version || 'v1.0.0',
      author: (item as any).author || '',
      instructions: (item as any).instructions || '',
      prompt_id: (item as any).prompt_id || '',
      tool_names: (item as any).tool_names || [],
      output_constraint: (item as any).output_constraint || '',
    }));
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'system':
        return <SystemPromptTab ref={systemRef} value={systemPrompt} onChange={setSystemPrompt} onAddFromWorkstation={() => setPickerTab('system')} />;
      case 'output':
        return <OutputConstraintTab ref={outputRef} value={outputConstraints} onChange={setOutputConstraints} onAddFromWorkstation={() => setPickerTab('output')} />;
      case 'tools':
        return (
          <ToolsTab
            items={tools.items}
            editingId={tools.editingId}
            showForm={form.forms.tool.show}
            formData={form.forms.tool.data as Parameters<typeof ToolsTab>[0]['formData']}
            formErrors={form.forms.tool.errors}
            editingItem={editingToolItem ? { id: editingToolItem.id, name: editingToolItem.name, description: editingToolItem.description || '', category: (editingToolItem as any).category || '', model: (editingToolItem as any).model || '', status: 'active', version: (editingToolItem as any).version || 'v1.0.0', endpoint: (editingToolItem as any).endpoint || '', parameters: (editingToolItem as any).parameters || '', createdAt: '' } : null}
            onToggle={tools.toggle}
            onAdd={() => tools.addCustom(() => ({ id: `custom-${Date.now()}`, name: '新工具', description: '', enabled: true, parameters: '' }) as AgentTool)}
            onUpdate={(id, name, desc) => tools.update(id, { name, description: desc } as Partial<AgentTool>)}
            onRemove={tools.remove}
            onStartEdit={tools.setEditingId}
            onFinishEdit={() => tools.setEditingId(null)}
            onPickerOpen={() => setPickerTab('tools')}
            onCustomize={() => { setEditingToolItem(null); form.openForm('tool'); }}
            onFormSave={() => saveFormItem('tool')}
            onFormClose={handleFormClose}
            setFormData={(fn) => form.updateFormData('tool', fn as (d: unknown) => unknown)}
            onEditFull={(item) => handleEditTool(item)}
          />
        );
      case 'mcp':
        return (
          <MCPTab
            items={mcp.items}
            editingId={mcp.editingId}
            showForm={form.forms.mcp.show}
            formData={form.forms.mcp.data as Parameters<typeof MCPTab>[0]['formData']}
            formErrors={form.forms.mcp.errors}
            editingItem={editingMcpItem ? { id: editingMcpItem.id, name: editingMcpItem.name, description: editingMcpItem.description || '' } : null}
            onToggle={mcp.toggle}
            onAdd={() => mcp.addCustom(() => ({ id: `custom-${Date.now()}`, name: '新 MCP', description: '', enabled: true }) as AgentMCP)}
            onUpdate={(id, name, desc) => mcp.update(id, { name, description: desc } as Partial<AgentMCP>)}
            onRemove={mcp.remove}
            onStartEdit={mcp.setEditingId}
            onFinishEdit={() => mcp.setEditingId(null)}
            onPickerOpen={() => setPickerTab('mcp')}
            onCustomize={() => { setEditingMcpItem(null); form.openForm('mcp'); }}
            onFormSave={() => saveFormItem('mcp')}
            onFormClose={() => { form.closeForm('mcp'); setEditingMcpItem(null); }}
            setFormData={(fn) => form.updateFormData('mcp', fn as (d: unknown) => unknown)}
            onEditFull={(item) => handleEditMcp(item)}
          />
        );
      case 'skills':
        return (
          <SkillsTab
            items={skills.items}
            editingId={skills.editingId}
            showForm={form.forms.skill.show}
            formData={form.forms.skill.data as Parameters<typeof SkillsTab>[0]['formData']}
            formErrors={form.forms.skill.errors}
            editingItem={editingSkillItem ? { id: editingSkillItem.id, name: editingSkillItem.name, description: editingSkillItem.description || '' } : null}
            onToggle={skills.toggle}
            onAdd={() => skills.addCustom(() => ({ id: `custom-${Date.now()}`, name: '新 Skill', description: '', enabled: true }) as AgentSkill)}
            onUpdate={(id, name, desc) => skills.update(id, { name, description: desc } as Partial<AgentSkill>)}
            onRemove={skills.remove}
            onStartEdit={skills.setEditingId}
            onFinishEdit={() => skills.setEditingId(null)}
            onPickerOpen={() => setPickerTab('skills')}
            onCustomize={() => { setEditingSkillItem(null); form.openForm('skill'); }}
            onFormSave={() => saveFormItem('skill')}
            onFormClose={() => { form.closeForm('skill'); setEditingSkillItem(null); }}
            setFormData={(fn) => form.updateFormData('skill', fn as (d: unknown) => unknown)}
            onEditFull={(item) => handleEditSkill(item)}
          />
        );
      default:
        return null;
    }
  };

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
              <h3 className="agent-config-title">配置 Agent</h3>
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
            <label className="form-label">Agent 名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="新 Agent" className="form-input" />
          </div>
          <div className="agent-config-field">
            <label className="form-label">Agent 描述</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="如：前端开发工程师、后端 API 设计师..." className="form-input" />
          </div>
          <p className="form-hint">简短描述该 Agent 的职责和专业领域</p>
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
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>保存配置</button>
        </div>
      </div>

      {pickerTab && (
        <PickerModal
          title={`从工作台添加 - ${{ system: '系统提示词', output: '输出约束', tools: '工具', mcp: 'MCP', skills: 'Skills' }[pickerTab]}`}
          items={pickerItems[pickerTab] || []}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTab(null)}
        />
      )}
    </div>
  );
}
