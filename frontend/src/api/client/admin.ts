import client from './instance';

export interface DashboardStats {
  agents: number;
  prompts: number;
  tools: number;
  mcps: number;
  skills: number;
  teams: number;
  logs_today: number;
  updated_at: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  entity_type: string;
  entity_name: string;
  detail: string;
  user: string;
  ip: string;
}

export interface CommandLogsResponse {
  items: LogEntry[];
  total: number;
  offset: number;
  limit: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const resp = await client.get('/admin/stats');
  return resp.data;
}

export async function fetchCommandLogs(limit = 50, offset = 0): Promise<CommandLogsResponse> {
  const resp = await client.get('/admin/logs', { params: { limit, offset } });
  return resp.data;
}

export interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string;
  detail: string;
  timestamp: string;
}

export async function fetchRecentActivity(limit = 10): Promise<ActivityEntry[]> {
  const resp = await client.get('/admin/activity', { params: { limit } });
  return resp.data;
}

export interface SystemHealth {
  status: string;
  checks: Record<string, string>;
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const resp = await client.get('/health', {
    validateStatus: (s: number) => (s >= 200 && s < 300) || s === 503,
  });
  return resp.data;
}
