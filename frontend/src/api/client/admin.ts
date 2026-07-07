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

export interface LogEntry {
  id: string;
  timestamp: string;
  command: string;
  payload: string;
  result: string;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const resp = await client.get('/admin/stats');
  return resp.data;
}

export async function fetchCommandLogs(limit = 50, offset = 0): Promise<LogEntry[]> {
  const resp = await client.get('/api/admin/logs', { params: { limit, offset } });
  return resp.data;
}
