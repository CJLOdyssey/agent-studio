import type { SkillEntry, SkillFormData } from './skill.types';
import { listSkills, createSkill, updateSkill, deleteSkill } from '../../../../api/client/skills';

export interface SkillAPIService {
  fetchAll(): Promise<SkillEntry[]>;
  create(data: SkillFormData): Promise<SkillEntry>;
  update(id: string, data: Partial<SkillEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: SkillEntry): Promise<SkillEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

function toEntry(item: { id: string; name: string; description: string; category: string; version: string; status: string; author: string; instructions: string; prompt_id: string | null; tool_names: unknown; output_constraint: string; created_at: string }): SkillEntry {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: (item.status === 'installed' || item.status === 'available') ? item.status : 'installed',
    version: item.version,
    author: item.author,
    instructions: item.instructions || '',
    prompt_id: item.prompt_id || '',
    tool_names: Array.isArray(item.tool_names) ? item.tool_names : [],
    output_constraint: item.output_constraint || '',
    createdAt: item.created_at.slice(0, 10),
  };
}

const realImpl: SkillAPIService = {
  fetchAll: async () => {
    const items = await listSkills();
    return items.map(toEntry);
  },
  create: async (data) => {
    const item = await createSkill({
      name: data.name,
      description: data.description,
      category: data.category,
      version: data.version,
      status: data.status,
      author: data.author,
      instructions: data.instructions || '',
    });
    return toEntry(item);
  },
  update: async (id, data) => {
    await updateSkill(id, { ...data });
  },
  remove: async (id) => { await deleteSkill(id); },
  clone: async (item) => {
    const created = await createSkill({
      name: `${item.name.slice(0, 48)} (副本)`,
      description: item.description,
      category: item.category,
      version: item.version,
      status: item.status,
      author: item.author,
      instructions: item.instructions || '',
    });
    return toEntry(created);
  },
  removeBatch: async (ids) => {
    await Promise.all(Array.from(ids).map(deleteSkill));
  },
};

export const skillAPI: SkillAPIService = realImpl;
