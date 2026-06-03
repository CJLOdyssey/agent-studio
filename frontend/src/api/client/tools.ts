import api from './instance';

export interface GeneratedTool {
  id: string;
  name: string;
  description: string;
  code: string;
  language: string;
  parameters: Record<string, { type: string; required?: boolean; default?: unknown }>;
  is_valid: boolean;
  error_message?: string | null;
  source?: 'template' | 'llm';
}

export interface ToolValidationResult {
  is_valid: boolean;
  error_message?: string | null;
  suggestions: string[];
}

export async function checkLlmStatus(): Promise<{ available: boolean }> {
  const { data } = await api.get('/system-team/llm/status');
  return data;
}

export async function generateTool(description: string, language: string = 'python'): Promise<GeneratedTool> {
  const { data } = await api.post('/tools/generate', { description, language });
  return data;
}

export async function generateToolWithLlm(description: string, language: string = 'python'): Promise<GeneratedTool> {
  const { data } = await api.post('/system-team/tools/generate', { description, language });
  return data;
}

export async function validateTool(code: string, language: string = 'python'): Promise<ToolValidationResult> {
  const { data } = await api.post('/tools/validate', { code, language });
  return data;
}

export async function executeTool(code: string, language: string = 'python'): Promise<{ success: boolean; output?: string; error?: string }> {
  const { data } = await api.post('/tools/execute', { code, language });
  return data;
}
