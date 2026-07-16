import ToolFormModal from '../workstation/tool/ToolFormModal';
import MCPFormModal from '../workstation/mcp/MCPFormModal';
import SkillFormModal from '../workstation/skill/SkillFormModal';
import type { ToolFormData } from '../workstation/tool/tool.types';
import type { MCPFormData } from '../workstation/mcp/mcp.types';
import type { SkillFormData } from '../workstation/skill/skill.types';
import type { ReactNode } from 'react';

interface Props {
  kind: 'tool' | 'mcp' | 'skill';
  form: { show: boolean; data: unknown; errors: string[] };
  editingItem: Record<string, unknown> | null;
  onSave: () => void;
  onClose: () => void;
  setFormData: (fn: (d: unknown) => unknown) => void;
  children: ReactNode;
}

function buildToolItem(item: Record<string, unknown> | null) {
  if (!item) return null;
  return {
    id: item.id as string,
    name: item.name as string,
    description: (item.description as string) || '',
    category: (item.category as string) || '',
    model: (item.model as string) || '',
    status: 'active' as const,
    version: (item.version as string) || 'v1.0.0',
    endpoint: (item.endpoint as string) || '',
    parameters: (item.parameters as string) || '',
    createdAt: '',
  };
}

function buildSkillItem(item: Record<string, unknown> | null) {
  if (!item) return null;
  return {
    id: item.id as string,
    name: item.name as string,
    description: (item.description as string) || '',
    category: (item.category as string) || '',
    status: ((item.status as string) || 'available') as 'available' | 'installed',
    version: (item.version as string) || 'v1.0.0',
    author: (item.author as string) || '',
    instructions: (item.instructions as string) || '',
    prompt_id: (item.prompt_id as string) || '',
    tool_names: (item.tool_names as string[]) || [],
    output_constraint: (item.output_constraint as string) || '',
    createdAt: '',
  };
}

export default function ItemEditor({ kind, form, editingItem, onSave, onClose, setFormData, children }: Props) {
  if (!form.show) return <>{children}</>;

  switch (kind) {
    case 'tool':
      return (
        <ToolFormModal
          editingItem={buildToolItem(editingItem)}
          formData={form.data as ToolFormData}
          setFormData={setFormData as (fn: (d: ToolFormData) => ToolFormData) => void}
          onSave={onSave}
          onClose={onClose}
          errors={form.errors}
        />
      );
    case 'mcp':
      return (
        <MCPFormModal
          editingItem={editingItem as import('../workstation/mcp/mcp.types').MCPEntry | null}
          formData={form.data as MCPFormData}
          setFormData={setFormData as (fn: (d: MCPFormData) => MCPFormData) => void}
          onSave={onSave}
          onClose={onClose}
          errors={form.errors}
        />
      );
    case 'skill':
      return (
        <SkillFormModal
          editingSkill={buildSkillItem(editingItem)}
          formData={form.data as SkillFormData}
          setFormData={setFormData as (fn: (d: SkillFormData) => SkillFormData) => void}
          onSave={onSave}
          onClose={onClose}
          errors={form.errors}
        />
      );
  }
}
