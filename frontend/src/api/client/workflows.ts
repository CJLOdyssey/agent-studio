import api from './instance';
import type { WorkflowConfig } from '../../types/AgentStudio';

export async function fetchWorkflow(teamId: string): Promise<WorkflowConfig | null> {
  try {
    const { data } = await api.get(`/workflows/teams/${teamId}`);
    return data;
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr.response?.status === 404) return null;
    throw err;
  }
}

export async function saveWorkflow(config: Omit<WorkflowConfig, 'id'> & { id?: string }): Promise<WorkflowConfig> {
  const { data } = await api.post('/workflows', config);
  return data;
}

export async function deleteWorkflow(configId: string): Promise<void> {
  await api.delete(`/workflows/${configId}`);
}

export async function listWorkflows(): Promise<WorkflowConfig[]> {
  const { data } = await api.get('/workflows');
  return data;
}
