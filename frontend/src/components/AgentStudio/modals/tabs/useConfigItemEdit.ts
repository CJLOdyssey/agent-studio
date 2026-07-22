import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentTool, AgentMCP, AgentSkill } from '../../../../types/AgentStudio';
import type { ToolFormData } from '../../workstation/tool/tool.types';
import { toolAPI } from '../../workstation/tool/api';

interface ItemListHandle<T> {
  items: T[];
  setItems: (v: T[]) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addCustom: (fn: () => T) => void;
  update: (id: string, updates: Partial<T>) => void;
  remove: (id: string) => void;
}

export interface ConfigItemEditReturn {
  editingToolItem: AgentTool | null;
  editingMcpItem: AgentMCP | null;
  editingSkillItem: AgentSkill | null;
  setEditingToolItem: (v: AgentTool | null) => void;
  setEditingMcpItem: (v: AgentMCP | null) => void;
  setEditingSkillItem: (v: AgentSkill | null) => void;
  itemsToFormData: (item: Record<string, unknown>) => ToolFormData;
  saveFormItem: (kind: 'tool' | 'mcp' | 'skill') => void;
  handleFormClose: () => void;
  handleEditTool: (item: Record<string, unknown>) => void;
  handleEditMcp: (item: Record<string, unknown>) => void;
  handleEditSkill: (item: Record<string, unknown>) => void;
}

export function useConfigItemEdit(
  tools: ItemListHandle<AgentTool>,
  mcp: ItemListHandle<AgentMCP>,
  skills: ItemListHandle<AgentSkill>,
  form: {
    forms: {
      tool: { data: ToolFormData };
      mcp: { data: unknown };
      skill: { data: unknown };
    };
    closeForm: (kind: 'tool' | 'mcp' | 'skill') => void;
    openForm: (kind: 'tool' | 'mcp' | 'skill') => void;
    updateFormData: (kind: 'tool' | 'mcp' | 'skill', fn: (d: unknown) => unknown) => void;
    setFormErrors: (kind: 'tool' | 'mcp' | 'skill', errors: string[]) => void;
  },
): ConfigItemEditReturn {
  const { t } = useTranslation();
  const [editingToolItem, setEditingToolItem] = useState<AgentTool | null>(null);
  const [editingMcpItem, setEditingMcpItem] = useState<AgentMCP | null>(null);
  const [editingSkillItem, setEditingSkillItem] = useState<AgentSkill | null>(null);

  function itemsToFormData(item: Record<string, unknown>): ToolFormData {
    return {
      name: (item.name as string) || '',
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

  function handleEditTool(item: Record<string, unknown>) {
    const tool = itemsToFormData(item);
    setEditingToolItem(item as unknown as AgentTool);
    form.openForm('tool');
    form.updateFormData('tool', () => tool);
  }

  function handleEditMcp(item: Record<string, unknown>) {
    setEditingMcpItem(item as unknown as AgentMCP);
    form.openForm('mcp');
    form.updateFormData('mcp', () => ({
      name: (item.name as string) || '',
      description: (item.description as string) || '',
      type: (item.type as string) || 'stdio',
      status: (item.status as string) || 'disconnected',
      version: (item.version as string) || 'v1.0.0',
      command: (item.command as string) || '',
      url: (item.url as string) || '',
    }));
  }

  function handleEditSkill(item: Record<string, unknown>) {
    setEditingSkillItem(item as unknown as AgentSkill);
    form.openForm('skill');
    form.updateFormData('skill', () => ({
      name: (item.name as string) || '',
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

  return {
    editingToolItem, editingMcpItem, editingSkillItem,
    setEditingToolItem, setEditingMcpItem, setEditingSkillItem,
    itemsToFormData, saveFormItem, handleFormClose,
    handleEditTool, handleEditMcp, handleEditSkill,
  };
}
