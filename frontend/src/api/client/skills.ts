import api from './instance';

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

export async function generateSkill(description: string, category: string = 'general'): Promise<GeneratedSkill> {
  const { data } = await api.post('/skills/generate', { description, category });
  return data;
}

export async function validateSkill(content: string): Promise<SkillValidationResult> {
  const { data } = await api.post('/skills/validate', { content });
  return data;
}
