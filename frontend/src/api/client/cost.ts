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
