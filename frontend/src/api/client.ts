import axios, { AxiosError } from 'axios';
import type { AgentConfig, ProjectRun, SessionDetail, SessionItem } from '../types';
import Logger from '../utils/logger';

// ---- Custom Error Class ----

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

function normalizeError(err: unknown): never {
  if (err instanceof AxiosError) {
    if (err.code === 'ECONNABORTED') {
      throw new TimeoutError('Request timed out');
    }
    if (!err.response) {
      throw new NetworkError(err.message || 'Network error');
    }
    const status = err.response.status;
    const data = err.response.data as Record<string, unknown> | undefined;
    const message = (data?.detail as string) || (data?.message as string) || err.message;

    switch (status) {
      case 401: {
        // Dispatch a custom event so the app layer can redirect to login
        window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { status: 401 } }));
        throw new ApiError(message, status, 'UNAUTHORIZED', data);
      }
      case 403:
        throw new ApiError(message, status, 'FORBIDDEN', data);
      case 404:
        throw new ApiError(message, status, 'NOT_FOUND', data);
      case 422:
        throw new ApiError(message, status, 'VALIDATION_ERROR', data);
      case 429: {
        const retryAfter = err.response.headers['retry-after'];
        throw new ApiError(message, status, 'RATE_LIMITED', { ...data, retryAfter });
      }
      case 500:
      case 502:
      case 503:
      case 504:
        Logger.error(`Server error ${status}`, { message, status, data });
        throw new ApiError(message, status, 'SERVER_ERROR', data);
      default:
        Logger.warn(`Unhandled API error ${status}`, { message, status });
        throw new ApiError(message, status, 'UNKNOWN', data);
    }
  }
  throw err;
}

// ---- Axios Instance ----

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  // CSRF protection: read token from cookie and send as header
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

// Interceptors — guarded for environments where axios may be mocked
if (api.interceptors?.request) {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

if (api.interceptors?.response) {
  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => normalizeError(error),
  );
}

// ---- API Functions ----

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

// ---- Models API ----

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
}

export async function listModels(): Promise<ModelInfo[]> {
  const { data } = await api.get('/models');
  return data;
}

// ---- Commands API ----

export interface CommandDef {
  id: string;
  name: string;
  description?: string;
  shortcut?: string;
  category?: string;
  requires_input?: boolean;
  enabled?: boolean;
}

export async function listCommands(): Promise<CommandDef[]> {
  const { data } = await api.get('/commands');
  return data;
}

export async function executeCommand(
  commandId: string,
  sessionId: string,
  payload?: Record<string, unknown>,
): Promise<{ success: boolean; message: string; data: Record<string, unknown> }> {
  const { data } = await api.post('/commands/execute', {
    command_id: commandId,
    session_id: sessionId,
    payload: payload ?? {},
  });
  return data;
}

export default api;
