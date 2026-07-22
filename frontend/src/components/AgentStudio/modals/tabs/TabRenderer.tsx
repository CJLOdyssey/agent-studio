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

export default function TabRenderer(props: TabRendererProps) {
  const {
    activeTab,
    systemRef,
    outputRef,
    systemPrompt,
    onSystemPromptChange,
    outputConstraints,
    onOutputConstraintsChange,
    tools,
    mcp,
    skills,
    form,
    editingToolItem,
    editingMcpItem,
    editingSkillItem,
    onSaveFormItem,
    onFormClose,
    onSetEditingMcpItem,
    onSetEditingSkillItem,
    onEditTool,
    onEditMcp,
    onEditSkill,
    onPickerOpen,
  } = props;

  switch (activeTab) {
    case 'system':
      return (
        <SystemPromptTab
          ref={systemRef}
          value={systemPrompt}
          onChange={onSystemPromptChange}
          onAddFromWorkstation={() => onPickerOpen('system')}
        />
      );
    case 'output':
      return (
        <OutputConstraintTab
          ref={outputRef}
          value={outputConstraints}
          onChange={onOutputConstraintsChange}
          onAddFromWorkstation={() => onPickerOpen('output')}
        />
      );
    case 'tools':
      return (
        <ItemEditor
          kind="tool"
          form={form.forms.tool}
          editingItem={toRecord(editingToolItem)}
          onSave={() => onSaveFormItem('tool')}
          onClose={onFormClose}
          setFormData={(fn) => form.updateFormData('tool', fn as (d: unknown) => unknown)}
        >
          <ToolsTab
            items={tools.items}
            editingId={tools.editingId}
            showForm={false}
            formData={form.forms.tool.data as Parameters<typeof ToolsTab>[0]['formData']}
            formErrors={form.forms.tool.errors}
            editingItem={null}
            onToggle={tools.toggle}
            onAdd={() =>
              tools.addCustom(
                () =>
                  ({
                    id: `custom-${Date.now()}`,
                    name: '新工具',
                    description: '',
                    enabled: true,
                    parameters: '',
                  }) as AgentTool,
              )
            }
            onUpdate={(id, name, desc) => tools.update(id, { name, description: desc } as Partial<AgentTool>)}
            onRemove={tools.remove}
            onStartEdit={tools.setEditingId}
            onFinishEdit={() => tools.setEditingId(null)}
            onPickerOpen={() => onPickerOpen('tools')}
            onCustomize={() => {
              tools.setEditingId(null);
              form.openForm('tool');
            }}
            onFormSave={() => {}}
            onFormClose={() => {}}
            setFormData={() => {}}
            onEditFull={(item) => onEditTool(item)}
          />
        </ItemEditor>
      );
    case 'mcp':
      return (
        <ItemEditor
          kind="mcp"
          form={form.forms.mcp}
          editingItem={toRecord(editingMcpItem)}
          onSave={() => onSaveFormItem('mcp')}
          onClose={() => {
            form.closeForm('mcp');
            onSetEditingMcpItem(null);
          }}
          setFormData={(fn) => form.updateFormData('mcp', fn as (d: unknown) => unknown)}
        >
          <MCPTab
            items={mcp.items}
            editingId={mcp.editingId}
            showForm={false}
            formData={form.forms.mcp.data as MCPFormData}
            formErrors={form.forms.mcp.errors}
            editingItem={null}
            onToggle={mcp.toggle}
            onAdd={() =>
              mcp.addCustom(
                () =>
                  ({
                    id: `custom-${Date.now()}`,
                    name: '新 MCP',
                    description: '',
                    enabled: true,
                  }) as AgentMCP,
              )
            }
            onUpdate={(id, name, desc) => mcp.update(id, { name, description: desc } as Partial<AgentMCP>)}
            onRemove={mcp.remove}
            onStartEdit={mcp.setEditingId}
            onFinishEdit={() => mcp.setEditingId(null)}
            onPickerOpen={() => onPickerOpen('mcp')}
            onCustomize={() => {
              mcp.setEditingId(null);
              form.openForm('mcp');
            }}
            onFormSave={() => {}}
            onFormClose={() => {}}
            setFormData={() => {}}
            onEditFull={(item) => onEditMcp(item)}
          />
        </ItemEditor>
      );
    case 'skills':
      return (
        <ItemEditor
          kind="skill"
          form={form.forms.skill}
          editingItem={toRecord(editingSkillItem)}
          onSave={() => onSaveFormItem('skill')}
          onClose={() => {
            form.closeForm('skill');
            onSetEditingSkillItem(null);
          }}
          setFormData={(fn) => form.updateFormData('skill', fn as (d: unknown) => unknown)}
        >
          <SkillsTab
            items={skills.items}
            editingId={skills.editingId}
            showForm={false}
            formData={form.forms.skill.data as SkillFormData}
            formErrors={form.forms.skill.errors}
            editingItem={null}
            onToggle={skills.toggle}
            onAdd={() =>
              skills.addCustom(
                () =>
                  ({
                    id: `custom-${Date.now()}`,
                    name: '新 Skill',
                    description: '',
                    enabled: true,
                  }) as AgentSkill,
              )
            }
            onUpdate={(id, name, desc) => skills.update(id, { name, description: desc } as Partial<AgentSkill>)}
            onRemove={skills.remove}
            onStartEdit={skills.setEditingId}
            onFinishEdit={() => skills.setEditingId(null)}
            onPickerOpen={() => onPickerOpen('skills')}
            onCustomize={() => {
              skills.setEditingId(null);
              form.openForm('skill');
            }}
            onFormSave={() => {}}
            onFormClose={() => {}}
            setFormData={() => {}}
            onEditFull={(item) => onEditSkill(item)}
          />
        </ItemEditor>
      );
    default:
      return null;
  }
}
