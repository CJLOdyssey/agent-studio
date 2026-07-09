import api from './instance';

export interface MCPItem {
  id: string;
  name: string;
  type: string;
  endpoint: string;
  config: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export async function listMCPs(): Promise<MCPItem[]> {
  const { data } = await api.get('/mcps');
  return data;
}

export async function createMCP(payload: { name: string; type: string; endpoint?: string; config?: Record<string, unknown> }): Promise<MCPItem> {
  const { data } = await api.post('/mcps', payload);
  return data;
}

export async function updateMCP(id: string, payload: Partial<{ name: string; type: string; endpoint: string; config: Record<string, unknown>; status: string }>): Promise<MCPItem> {
  const { data } = await api.put(`/mcps/${id}`, payload);
  return data;
}

export async function deleteMCP(id: string): Promise<void> {
  await api.delete(`/mcps/${id}`);
}
