import api from './instance';
import type { AgentConfig } from '../../types';

export async function listAgents(): Promise<AgentConfig[]> {
  const { data } = await api.get('/agents');
  return data;
}

export async function createAgent(cfg: {
  name: string;
  role_identifier: string;
  system_prompt: string;
  output_constraints?: string;
  tools?: Array<{ id: string; name: string; description: string; enabled: boolean }>;
  mcp?: Array<{ id: string; name: string; serverUrl: string; enabled: boolean }>;
  skills?: Array<{ id: string; name: string; description: string; enabled: boolean }>;
  order: number;
  is_active: boolean;
  is_approver: boolean;
  icon: string;
  model?: string | null;
  temperature?: number | null;
}): Promise<{ id: string }> {
  const { data } = await api.post('/agents', cfg);
  return data;
}

export async function updateAgent(
  id: string,
  cfg: {
    name?: string;
    system_prompt?: string;
    output_constraints?: string;
    tools?: Array<{ id: string; name: string; description: string; enabled: boolean }>;
    mcp?: Array<{ id: string; name: string; serverUrl: string; enabled: boolean }>;
    skills?: Array<{ id: string; name: string; description: string; enabled: boolean }>;
    order?: number;
    is_active?: boolean;
    is_approver?: boolean;
    icon?: string;
    model?: string | null;
    temperature?: number | null;
  },
): Promise<void> {
  await api.put(`/agents/${id}`, cfg);
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function toggleAgent(id: string): Promise<{ id: string; is_active: boolean }> {
  const { data } = await api.put(`/agents/${id}/toggle`);
  return data;
}
