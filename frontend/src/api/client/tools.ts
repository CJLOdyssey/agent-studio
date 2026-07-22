import api from './instance';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  category: string;
  model: string | null;
  status: string;
  version: string;
  endpoint: string;
  created_at: string;
}

export interface ToolValidationResult {
  is_valid: boolean;
  error_message?: string | null;
  suggestions: string[];
}

export async function listTools(): Promise<ToolItem[]> {
  const { data } = await api.get('/tools');
  return data;
}

export async function createTool(payload: { name: string; description: string; category: string; model?: string; status?: string; version?: string; endpoint?: string; parameters?: string }): Promise<ToolItem> {
  const { data } = await api.post('/tools', payload);
  return data;
}

export async function updateTool(id: string, payload: Partial<{ name: string; description: string; category: string; model: string; status: string; version: string; endpoint: string; parameters: string }>): Promise<ToolItem> {
  const { data } = await api.put(`/tools/${id}`, payload);
  return data;
}

export async function deleteTool(id: string): Promise<void> {
  await api.delete(`/tools/${id}`);
}

export async function validateTool(code: string, language: string = 'python'): Promise<ToolValidationResult> {
  const { data } = await api.post('/tools/validate', { code, language });
  return data;
}

export async function executeTool(
  code: string,
  language: string = 'python',
): Promise<{ success: boolean; output?: string; error?: string }> {
  const { data } = await api.post('/tools/execute', { code, language });
  return data;
}

export interface ToolTestResult {
  success: boolean;
  status_code: number | null;
  duration_ms: number;
  message: string;
  body: string | null;
}

export async function testTool(id: string): Promise<ToolTestResult> {
  const { data } = await api.post(`/tools/${id}/test`);
  return data;
}
