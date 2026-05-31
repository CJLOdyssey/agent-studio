import axios from 'axios';
import type { AgentConfig, ProjectRun, SessionDetail, SessionItem } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export async function submitRequirement(
  requirement: string,
  session_id?: string,
): Promise<{ run_id: string; status: string }> {
  const { data } = await api.post('/runs', { requirement, session_id });
  return data;
}

// ---- Session API ----

export async function listSessions(limit = 50): Promise<SessionItem[]> {
  const { data } = await api.get('/sessions', { params: { limit } });
  return data;
}

export async function getSessionDetail(sessionId: string): Promise<SessionDetail> {
  const { data } = await api.get(`/sessions/${sessionId}`);
  return data;
}

export async function createSession(title = '新对话'): Promise<{ id: string; title: string }> {
  const { data } = await api.post('/sessions', { title });
  return data;
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  await api.put(`/sessions/${sessionId}`, { title });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}`);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  await api.delete(`/memories/${memoryId}`);
}

export async function exportSessionMemories(sessionId: string, format: 'json' | 'md'): Promise<Blob> {
  const { data } = await api.get(`/sessions/${sessionId}/memories/export`, {
    params: { format },
    responseType: 'blob',
  });
  return data;
}

export async function getRun(runId: string): Promise<ProjectRun> {
  const { data } = await api.get(`/runs/${runId}`);
  return data;
}

export async function listRuns(limit = 20, offset?: number): Promise<ProjectRun[]> {
  const { data } = await api.get('/runs', { params: { limit, ...(offset !== undefined && { offset }) } });
  return data;
}

export async function healthCheck(): Promise<Record<string, unknown>> {
  const { data } = await api.get('/health');
  return data;
}

// ---- Agent Config API ----

export async function listAgents(): Promise<AgentConfig[]> {
  const { data } = await api.get('/agents');
  return data;
}

export async function createAgent(cfg: {
  name: string;
  role_identifier: string;
  system_prompt: string;
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
