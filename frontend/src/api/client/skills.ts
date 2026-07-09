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

export interface GeneratedSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  is_valid: boolean;
  error_message?: string | null;
}

export interface SkillValidationResult {
  is_valid: boolean;
  error_message?: string | null;
  suggestions: string[];
}

export async function listSkills(): Promise<SkillItem[]> {
  const { data } = await api.get('/skills');
  return data;
}

export async function createSkill(payload: { name: string; description: string; category: string; version?: string; status?: string; author?: string; instructions?: string }): Promise<SkillItem> {
  const { data } = await api.post('/skills', payload);
  return data;
}

export async function updateSkill(id: string, payload: Partial<{ name: string; description: string; category: string; version: string; status: string; author: string }>): Promise<SkillItem> {
  const { data } = await api.put(`/skills/${id}`, payload);
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/skills/${id}`);
}


export async function generateSkill(description: string, category: string = 'general'): Promise<GeneratedSkill> {
  const { data } = await api.post('/skills/generate', { description, category });
  return data;
}

export async function validateSkill(content: string): Promise<SkillValidationResult> {
  const { data } = await api.post('/skills/validate', { content });
  return data;
}
