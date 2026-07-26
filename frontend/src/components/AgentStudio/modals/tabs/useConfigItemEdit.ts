import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentTool, AgentMCP, AgentSkill } from '../../../../types/AgentStudio';
import type { ToolFormData } from '../../workstation/tool/tool.types';
import type { MCPFormData } from '../../workstation/mcp/mcp.types';
import type { SkillFormData } from '../../workstation/skill/skill.types';
import { toolAPI } from '../../workstation/tool/api';
import { mcpAPI } from '../../workstation/mcp/api';
import { skillAPI } from '../../workstation/skill/api';

type ArchiveKind = 'tool' | 'mcp' | 'skill';

interface ItemListHandle<T> {
  items: T[];
  setItems: (v: T[]) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addCustom: (fn: () => T) => void;
  update: (id: string, updates: Partial<T>) => void;
  remove: (id: string) => void;
}

export interface PendingArchiveState {
  kind: ArchiveKind;
  kindName: string;
  name: string;
  customId: string;
  data: ToolFormData | MCPFormData | SkillFormData;
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
  pendingArchive: PendingArchiveState | null;
  archiveItem: (kind: ArchiveKind, customId: string, data: ToolFormData | MCPFormData | SkillFormData) => void;
  setPendingArchive: (v: PendingArchiveState | null) => void;
  handleArchiveFromMenu: (kind: ArchiveKind, item: Record<string, unknown>) => void;
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
  const [pendingArchive, setPendingArchive] = useState<PendingArchiveState | null>(null);

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

  function itemsToMCPFormData(item: Record<string, unknown>): MCPFormData {
    return {
      name: (item.name as string) || '',
      description: (item.description as string) || '',
      type: (item.type as 'stdio' | 'sse') || 'stdio',
      status: (item.status as 'error' | 'disconnected' | 'connected') || 'disconnected',
      version: (item.version as string) || 'v1.0.0',
      command: (item.command as string) || '',
      url: (item.url as string) || '',
    };
  }

  function itemsToSkillFormData(item: Record<string, unknown>): SkillFormData {
    return {
      name: (item.name as string) || '',
      description: (item.description as string) || '',
      category: (item.category as string) || 'AI/ML',
      status: (item.status as 'installed' | 'available') || 'available',
      model: (item.model as string) || 'GPT-4o',
      version: (item.version as string) || 'v1.0.0',
      author: (item.author as string) || '',
      instructions: (item.instructions as string) || '',
      prompt_id: (item.prompt_id as string) || '',
      tool_names: (item.tool_names as string[]) || [],
      output_constraint: (item.output_constraint as string) || '',
    };
  }

  function handleFormClose() {
    form.closeForm('tool');
    setEditingToolItem(null);
    setEditingMcpItem(null);
    setEditingSkillItem(null);
  }

  function archiveItem(kind: ArchiveKind, customId: string, data: ToolFormData | MCPFormData | SkillFormData) {
    const onDone = () => setPendingArchive(null);
    switch (kind) {
      case 'tool':
        toolAPI.create(data as ToolFormData).then((entry) => {
          tools.update(customId, { id: entry.id, archived: true } as Partial<AgentTool>);
          onDone();
        }).catch(onDone);
        break;
      case 'mcp':
        mcpAPI.create(data as MCPFormData).then((entry) => {
          mcp.update(customId, { id: entry.id, archived: true } as Partial<AgentMCP>);
          onDone();
        }).catch(onDone);
        break;
      case 'skill':
        skillAPI.create(data as SkillFormData).then((entry) => {
          skills.update(customId, { id: entry.id, archived: true } as Partial<AgentSkill>);
          onDone();
        }).catch(onDone);
        break;
    }
  }

  function saveFormItem(kind: 'tool' | 'mcp' | 'skill') {
    const f = form.forms[kind];
    const fdata = f.data as Record<string, unknown>;
    if (typeof fdata.name !== 'string' || !fdata.name.trim()) {
      form.setFormErrors(kind, [t('workstation.nameRequired')]);
      return;
    }
    const data = f.data as Record<string, string>;
    const customId = `custom-${Date.now()}`;
    switch (kind) {
      case 'tool':
        if (editingToolItem) {
          tools.update(editingToolItem.id, { name: data.name, description: data.description || '', parameters: data.parameters || '' } as Partial<AgentTool>);
          setEditingToolItem(null);
          form.closeForm(kind);
        } else {
          tools.addCustom(() => ({ id: customId, name: data.name, description: data.description || '', enabled: true, parameters: data.parameters || '' }) as AgentTool);
          form.closeForm(kind);
          setPendingArchive({ kind, kindName: '工具', name: data.name, customId, data: f.data as ToolFormData });
        }
        break;
      case 'mcp':
        if (editingMcpItem) {
          mcp.update(editingMcpItem.id, { name: data.name, description: data.description || '' } as Partial<AgentMCP>);
          setEditingMcpItem(null);
          form.closeForm(kind);
        } else {
          mcp.addCustom(() => ({ id: customId, name: data.name, description: data.description || '', enabled: true }) as AgentMCP);
          form.closeForm(kind);
          setPendingArchive({ kind, kindName: 'MCP', name: data.name, customId, data: f.data as MCPFormData });
        }
        break;
      case 'skill':
        if (editingSkillItem) {
          skills.update(editingSkillItem.id, { name: data.name, description: data.description || '' } as Partial<AgentSkill>);
          setEditingSkillItem(null);
          form.closeForm(kind);
        } else {
          skills.addCustom(() => ({ id: customId, name: data.name, description: data.description || '', enabled: true }) as AgentSkill);
          form.closeForm(kind);
          setPendingArchive({ kind, kindName: 'Skill', name: data.name, customId, data: f.data as SkillFormData });
        }
        break;
    }
  }

  function handleEditTool(item: Record<string, unknown>) {
    const tool = itemsToFormData(item);
    setEditingToolItem({
      id: String(item.id ?? `edit-${Date.now()}`),
      name: tool.name,
      description: tool.description,
      enabled: true,
    });
    form.openForm('tool');
    form.updateFormData('tool', () => tool);
  }

  function handleEditMcp(item: Record<string, unknown>) {
    setEditingMcpItem({
      id: String(item.id ?? `edit-${Date.now()}`),
      name: (item.name as string) || '',
      description: (item.description as string) || '',
      serverUrl: (item.serverUrl as string) || '',
      enabled: true,
    });
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
    setEditingSkillItem({
      id: String(item.id ?? `edit-${Date.now()}`),
      name: (item.name as string) || '',
      description: (item.description as string) || '',
      enabled: true,
    });
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

  function handleArchiveFromMenu(kind: ArchiveKind, item: Record<string, unknown>) {
    const customId = String(item.id ?? '');
    let data: ToolFormData | MCPFormData | SkillFormData;
    switch (kind) {
      case 'tool':
        data = itemsToFormData(item);
        break;
      case 'mcp':
        data = itemsToMCPFormData(item);
        break;
      case 'skill':
        data = itemsToSkillFormData(item);
        break;
    }
    archiveItem(kind, customId, data);
  }

  return {
    editingToolItem, editingMcpItem, editingSkillItem,
    setEditingToolItem, setEditingMcpItem, setEditingSkillItem,
    itemsToFormData, saveFormItem, handleFormClose,
    handleEditTool, handleEditMcp, handleEditSkill,
    pendingArchive, archiveItem, setPendingArchive, handleArchiveFromMenu,
  };
}
