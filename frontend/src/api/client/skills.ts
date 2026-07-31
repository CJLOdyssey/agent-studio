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
  tool_names: string[];
  output_constraint: string;
}>): Promise<SkillItem> {
  const { data } = await api.put(`/skills/${id}`, payload);
  return data;
}

export async function deleteSkill(id: string): Promise<void> {
  await api.delete(`/skills/${id}`);
}

export async function importSkillFromMarkdown(markdown: string, category = '导入'): Promise<SkillItem> {
  const { data } = await api.post('/skills/import-text', { markdown, category });
  return data;
}

export async function importSkillDirectory(files: File[], category = '导入'): Promise<SkillItem> {
  const form = new FormData();
  form.append('category', category);
  for (const f of files) {
    form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
  }
  const { data } = await api.post('/skills/import', form);
  return data;
}
