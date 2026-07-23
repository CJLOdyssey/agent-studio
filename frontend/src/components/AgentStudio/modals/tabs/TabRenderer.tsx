import { SystemPromptTab } from './SystemPromptTab';
import { OutputConstraintTab } from './OutputConstraintTab';
import { ToolsTab } from './ToolsTab';
import { MCPTab } from './MCPTab';
import { SkillsTab } from './SkillsTab';
import ItemEditor from '../ItemEditor';
import type { AgentTool, AgentMCP, AgentSkill } from '../../../../types/AgentStudio';
import type { ToolFormData } from '../../workstation/tool/tool.types';
import type { MCPFormData } from '../../workstation/mcp/mcp.types';
import type { SkillFormData } from '../../workstation/skill/skill.types';
import type { ReactNode } from 'react';

function toRecord(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

interface ItemListShape<T> {
  items: T[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  toggle: (id: string) => void;
  addCustom: (createItem: () => T) => void;
  update: (id: string, updates: Partial<T>) => void;
  remove: (id: string) => void;
}

interface TabRendererProps {
  activeTab: string;
  systemRef: React.RefObject<HTMLTextAreaElement>;
  outputRef: React.RefObject<HTMLTextAreaElement>;
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
  outputConstraints: string;
  onOutputConstraintsChange: (v: string) => void;
  tools: ItemListShape<AgentTool>;
  mcp: ItemListShape<AgentMCP>;
  skills: ItemListShape<AgentSkill>;
  form: {
    forms: {
      tool: { show: boolean; data: ToolFormData; errors: string[] };
      mcp: { show: boolean; data: MCPFormData; errors: string[] };
      skill: { show: boolean; data: SkillFormData; errors: string[] };
    };
    openForm: (kind: 'tool' | 'mcp' | 'skill') => void;
    closeForm: (kind: 'tool' | 'mcp' | 'skill') => void;
    updateFormData: (kind: 'tool' | 'mcp' | 'skill', fn: (d: unknown) => unknown) => void;
  };
  editingToolItem: AgentTool | null;
  editingMcpItem: AgentMCP | null;
  editingSkillItem: AgentSkill | null;
  onSaveFormItem: (kind: 'tool' | 'mcp' | 'skill') => void;
  onFormClose: () => void;
  onSetEditingMcpItem: (v: AgentMCP | null) => void;
  onSetEditingSkillItem: (v: AgentSkill | null) => void;
  onEditTool: (item: Record<string, unknown>) => void;
  onEditMcp: (item: Record<string, unknown>) => void;
  onEditSkill: (item: Record<string, unknown>) => void;
  onPickerOpen: (tab: string) => void;
  itemsToFormData: (item: Record<string, unknown>) => ToolFormData;
}

type TabKind = 'tool' | 'mcp' | 'skill';

interface TabConfig<T, F> {
  kind: TabKind;
  showForm: boolean;
  editingItem: unknown;
  list: ItemListShape<T>;
  formData: F;
  formErrors: string[];
  onEditFull: (item: Record<string, unknown>) => void;
  onCustomize: () => void;
  onPickerOpen: () => void;
  defaultItem: T;
  renderTab: (ctx: {
    items: T[]; editingId: string | null; showForm: boolean; formData: F;
    formErrors: string[]; editingItem: null;
    onToggle: (id: string) => void; onAdd: () => void;
    onUpdate: (id: string, name: string, desc: string) => void;
    onRemove: (id: string) => void;
    onStartEdit: (id: string) => void; onFinishEdit: () => void;
    onPickerOpen: () => void; onCustomize: () => void;
    onFormSave: () => void; onFormClose: () => void;
    setFormData: () => void;
    onEditFull: (item: Record<string, unknown>) => void;
  }) => ReactNode;
}

function renderItemTab<T extends { id: string; name?: string; description?: string }, F>(cfg: TabConfig<T, F>) {
  return (
    <ItemEditor
      kind={cfg.kind}
      form={{ show: false, data: cfg.formData, errors: cfg.formErrors }}
      editingItem={toRecord(cfg.editingItem)}
      onSave={() => undefined}
      onClose={() => undefined}
      setFormData={() => undefined}
    >
      {cfg.renderTab({
        items: cfg.list.items,
        editingId: cfg.list.editingId,
        showForm: cfg.showForm,
        formData: cfg.formData,
        formErrors: cfg.formErrors,
        editingItem: null,
        onToggle: cfg.list.toggle,
        onAdd: () => cfg.list.addCustom(() => ({ ...cfg.defaultItem, id: `custom-${Date.now()}` }) as T),
        onUpdate: (id, name, desc) => cfg.list.update(id, { name, description: desc } as Partial<T>),
        onRemove: cfg.list.remove,
        onStartEdit: cfg.list.setEditingId,
        onFinishEdit: () => cfg.list.setEditingId(null),
        onPickerOpen: cfg.onPickerOpen,
        onCustomize: cfg.onCustomize,
        onFormSave: () => undefined,
        onFormClose: () => undefined,
        setFormData: () => undefined,
        onEditFull: cfg.onEditFull,
      })}
    </ItemEditor>
  );
}

export default function TabRenderer(props: TabRendererProps) {
  const {
    activeTab, systemRef, outputRef, systemPrompt, onSystemPromptChange,
    outputConstraints, onOutputConstraintsChange,
    tools, mcp, skills, form,
    editingToolItem, editingMcpItem, editingSkillItem,
    onEditTool, onEditMcp, onEditSkill, onPickerOpen,
  } = props;

  switch (activeTab) {
    case 'system':
      return (
        <SystemPromptTab
          ref={systemRef} value={systemPrompt} onChange={onSystemPromptChange}
          onAddFromWorkstation={() => onPickerOpen('system')}
        />
      );
    case 'output':
      return (
        <OutputConstraintTab
          ref={outputRef} value={outputConstraints} onChange={onOutputConstraintsChange}
          onAddFromWorkstation={() => onPickerOpen('output')}
        />
      );
    case 'tools':
      return renderItemTab<AgentTool, ToolFormData>({
        kind: 'tool', showForm: form.forms.tool.show, editingItem: editingToolItem, list: tools,
        formData: form.forms.tool.data, formErrors: form.forms.tool.errors,
        defaultItem: { name: '新工具', description: '', enabled: true, parameters: '' } as AgentTool,
        onEditFull: onEditTool,
        onCustomize: () => { tools.setEditingId(null); form.openForm('tool'); },
        onPickerOpen: () => onPickerOpen('tools'),
        renderTab: (ctx) => <ToolsTab {...ctx} />,
      });
    case 'mcp':
      return renderItemTab<AgentMCP, MCPFormData>({
        kind: 'mcp', showForm: form.forms.mcp.show, editingItem: editingMcpItem, list: mcp,
        formData: form.forms.mcp.data, formErrors: form.forms.mcp.errors,
        defaultItem: { name: '新 MCP', description: '', enabled: true } as AgentMCP,
        onEditFull: onEditMcp,
        onCustomize: () => { mcp.setEditingId(null); form.openForm('mcp'); },
        onPickerOpen: () => onPickerOpen('mcp'),
        renderTab: (ctx) => <MCPTab {...ctx} />,
      });
    case 'skills':
      return renderItemTab<AgentSkill, SkillFormData>({
        kind: 'skill', showForm: form.forms.skill.show, editingItem: editingSkillItem, list: skills,
        formData: form.forms.skill.data, formErrors: form.forms.skill.errors,
        defaultItem: { name: '新 Skill', description: '', enabled: true } as AgentSkill,
        onEditFull: onEditSkill,
        onCustomize: () => { skills.setEditingId(null); form.openForm('skill'); },
        onPickerOpen: () => onPickerOpen('skills'),
        renderTab: (ctx) => <SkillsTab {...ctx} />,
      });
    default:
      return null;
  }
}
