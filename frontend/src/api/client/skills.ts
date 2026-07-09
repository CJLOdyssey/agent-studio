import api from './instance';

export interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  status: string;
  author: string;
  instructions: string;
  prompt_id: string | null;
  tool_names: string[];
  output_constraint: string;
  created_at: string;
}

export async function listSkills(): Promise<SkillItem[]> {
  const { data } = await api.get('/skills');
  return data;
}

export async function createSkill(payload: {
  name: string;
  description: string;
  category: string;
  version?: string;
  status?: string;
  author?: string;
  instructions?: string;
  prompt_id?: string;
  tool_names?: string[];
  output_constraint?: string;
}): Promise<SkillItem> {
  const { data } = await api.post('/skills', payload);
  return data;
}

export async function updateSkill(id: string, payload: Partial<{
  name: string;
  description: string;
  category: string;
  version: string;
  status: string;
  author: string;
  instructions: string;
  prompt_id: string;
  tool_names: string[];
  output_constraint: string;
}>): Promise<SkillItem> {
  const { data } = await api.put(`/skills/${id}`, payload);
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/skills/${id}`);
}
