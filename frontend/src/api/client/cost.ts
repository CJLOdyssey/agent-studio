import client from './instance';

export interface TokenUsage {
  id: string;
  run_id: string;
  node_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  timestamp: string;
}

export interface TokenUsageResponse {
  run_id: string;
  total_tokens: number;
  total_cost_usd: number;
  usages: TokenUsage[];
}

export interface CostSummary {
  period_days: number;
  total_tokens: number;
  total_cost_usd: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_calls: number;
  by_model: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;
  by_node: Record<string, {
    tokens: number;
    cost_usd: number;
    calls: number;
  }>;
}

export interface ModelPricing {
  model: string;
  prompt_cost_per_1k: number;
  completion_cost_per_1k: number;
}

export interface DailyTrendItem {
  day: string;
  total_tokens: number;
  total_cost: number;
  calls: number;
}

export interface CostAttribution {
  by_team: Record<string, { tokens: number; cost_usd: number; calls: number }>;
  by_node: Record<string, { tokens: number; cost_usd: number; calls: number }>;
}

export interface PerformanceSummary {
  period_days: number;
  avg_response_time_s: number;
  avg_success_rate: number;
  avg_tokens_per_call: number;
  total_calls: number;
}

export interface PerformanceTrendItem {
  time_bucket: string;
  avg_response_time_s: number;
  success_rate: number;
  calls: number;
}

export interface AgentRankingItem {
  node_id: string;
  avg_response_time_s: number;
  success_rate: number;
  total_calls: number;
  total_tokens: number;
}

export async function fetchTokenUsage(runId: string): Promise<TokenUsageResponse> {
  const resp = await client.get('/cost/token-usage', { params: { run_id: runId } });
  return resp.data;
}

export async function fetchCostSummary(teamId?: string, days = 7): Promise<CostSummary> {
  const params: Record<string, string | number> = { days };
  if (teamId) params.team_id = teamId;
  const resp = await client.get('/cost/summary', { params });
  return resp.data;
}

export async function fetchModelPricing(): Promise<ModelPricing[]> {
  const resp = await client.get('/cost/models');
  return resp.data.models;
}

export async function fetchDailyTrend(teamId?: string, days = 7): Promise<DailyTrendItem[]> {
  const params: Record<string, string | number> = { days };
  if (teamId) params.team_id = teamId;
  const resp = await client.get('/cost/daily-trend', { params });
  return resp.data.trend;
}

export async function fetchCostAttribution(teamId?: string, days = 7): Promise<CostAttribution> {
  const params: Record<string, string | number> = { days };
  if (teamId) params.team_id = teamId;
  const resp = await client.get('/cost/attribution', { params });
  return resp.data;
}

export async function fetchPerformanceSummary(teamId?: string, days = 7): Promise<PerformanceSummary> {
  const params: Record<string, string | number> = { days };
  if (teamId) params.team_id = teamId;
  const resp = await client.get('/cost/performance/summary', { params });
  return resp.data;
}

export async function fetchPerformanceTrend(teamId?: string, days = 7): Promise<PerformanceTrendItem[]> {
  const params: Record<string, string | number> = { days };
  if (teamId) params.team_id = teamId;
  const resp = await client.get('/cost/performance/trend', { params });
  return resp.data.trend;
}

export async function fetchAgentRanking(teamId?: string, days = 7): Promise<AgentRankingItem[]> {
  const params: Record<string, string | number> = { days };
  if (teamId) params.team_id = teamId;
  const resp = await client.get('/cost/performance/ranking', { params });
  return resp.data.ranking;
}
