import client from './instance';

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

export interface DailyModelBreakdown {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  calls: number;
}

export interface DailyTrendItem {
  day: string;
  total_tokens: number;
  total_cost: number;
  calls: number;
  by_model: Record<string, DailyModelBreakdown>;
}

export interface UsageHistoryItem {
  /** 完整时间戳（ISO 8601，含时刻） */
  date: string;
  timestamp: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  /** true 表示模型未在定价表配置（cost=0 是“未计价”而非“免费”） */
  unpriced?: boolean;
  run_id: string;
  node_id: string;
}

export interface UsageHistoryPage {
  history: UsageHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * 绝对日期区间（YYYY-MM-DD，两端闭区间）。
 *
 * 预设（最近 7 天）与自定义区间在请求层统一降维成绝对日期，
 * 这样后端只有一种时间语义，前端也不再区分“天数”与“区间”。
 */
export interface DateRange {
  start: string;
  end: string;
}

/** 所有成本/性能接口的公共查询作用域。 */
export interface CostScope {
  teamId?: string;
  range: DateRange;
}

/** 用户维度的交叉过滤（点击归因「按用户」行 → 全页按用户过滤）。 */
export interface UserScoped {
  userId?: string;
}

/** 节点维度的交叉过滤（点击归因「按节点」行 → 全页按该节点过滤）。 */
export interface NodeScoped {
  nodeId?: string;
}

/** API 密钥维度过滤（顶部「所有密钥」，user_api_keys.id）。 */
export interface KeyScoped {
  keyId?: string;
}

export interface CostModelScope extends CostScope, UserScoped, NodeScoped, KeyScoped {
  model?: string;
}

export type TrendGranularity = 'hour' | 'day' | 'week' | 'month';

/** 趋势查询作用域：额外携带聚合粒度。 */
export interface TrendScope extends CostModelScope {
  granularity: TrendGranularity;
}

/** 把作用域序列化成查询参数（单一实现，避免各接口参数发散）。 */
function toScopeParams({
  teamId,
  range,
  model,
  userId,
  nodeId,
  keyId,
}: CostModelScope): Record<string, string> {
  const params: Record<string, string> = {
    start_date: range.start,
    end_date: range.end,
  };
  if (teamId) params.team_id = teamId;
  if (model) params.model = model;
  if (userId) params.user_id = userId;
  if (nodeId) params.node_id = nodeId;
  if (keyId) params.key_id = keyId;
  return params;
}

export interface PerformanceSummary {
  period_days: number;
  avg_response_time_s: number;
  p50_response_time_s?: number;
  p95_response_time_s?: number;
  avg_success_rate: number;
  avg_tokens_per_call: number;
  total_calls: number;
}

export interface PerformanceTrendItem {
  time_bucket: string;
  avg_response_time_s: number;
  success_rate: number;
  calls: number;
  avg_tokens?: number;
  /** hour 粒度下该桶内每条 run 的精确发起时刻 + 耗时（tooltip 单条明细） */
  runs?: { t: string; dur: number }[];
}

export async function fetchCostSummary(scope: CostModelScope): Promise<CostSummary> {
  const resp = await client.get('/cost/summary', { params: toScopeParams(scope) });
  return resp.data;
}

export async function fetchDailyTrend({
  granularity,
  ...scope
}: TrendScope): Promise<DailyTrendItem[]> {
  const params = toScopeParams(scope);
  params.granularity = granularity;
  // 用户时区：浏览器本地东偏移分钟（+8 → 480），后端按它把日界/小时桶切成本地
  params.tz_offset_min = String(-new Date().getTimezoneOffset());
  const resp = await client.get('/cost/daily-trend', { params });
  return resp.data.trend;
}

/** 使用历史排序字段（与后端白名单一致，非法值后端 422）。 */
export type UsageOrderKey = 'timestamp' | 'prompt_tokens' | 'completion_tokens' | 'cost_usd';
export type UsageOrderDir = 'asc' | 'desc';

export interface UsageHistoryQuery extends CostModelScope {
  limit?: number;
  offset?: number;
  /** 模糊匹配 run_id / model（大小写不敏感，服务端过滤） */
  search?: string;
  order_by?: UsageOrderKey;
  order_dir?: UsageOrderDir;
}

export async function fetchUsageHistory({
  limit = 50,
  offset = 0,
  search,
  order_by,
  order_dir,
  ...scope
}: UsageHistoryQuery): Promise<UsageHistoryPage> {
  const resp = await client.get('/cost/usage-history', {
    params: { ...toScopeParams(scope), limit, offset, search, order_by, order_dir },
  });
  return resp.data as UsageHistoryPage;
}

/**
 * 导出当前作用域下的全部明细（不走分页）。
 * 用于「导出 CSV」时拿全量，而不是只导出已加载的一页。
 * search 与表格过滤同口径：表格看到什么就导出什么。
 */
export async function fetchUsageHistoryForExport(
  scope: CostModelScope & { search?: string },
): Promise<UsageHistoryItem[]> {
  const { search, ...rest } = scope;
  const resp = await client.get('/cost/usage-history/export', {
    params: { ...toScopeParams(rest), search },
  });
  return (resp.data as { history: UsageHistoryItem[] }).history;
}

export async function fetchPerformanceSummary({ teamId, range }: CostScope): Promise<PerformanceSummary> {
  const resp = await client.get('/cost/performance/summary', {
    params: toScopeParams({ teamId, range }),
  });
  return resp.data;
}

export async function fetchPerformanceTrend({
  granularity,
  ...scope
}: TrendScope): Promise<PerformanceTrendItem[]> {
  const params = toScopeParams(scope);
  params.granularity = granularity;
  // 用户时区：浏览器本地东偏移分钟（+8 → 480），后端按它把日界/小时桶切成本地
  params.tz_offset_min = String(-new Date().getTimezoneOffset());
  const resp = await client.get('/cost/performance/trend', { params });
  return resp.data.trend;
}

export interface BudgetStatus {
  daily_limit: number;
  monthly_limit: number;
  daily_spend: number;
  monthly_spend: number;
  daily_exceeded: boolean;
  monthly_exceeded: boolean;
  daily_percent: number;
  monthly_percent: number;
}

export async function fetchBudgetStatus(): Promise<BudgetStatus> {
  const resp = await client.get('/cost/budget');
  return resp.data;
}

export async function updateBudget(dailyLimit: number, monthlyLimit: number): Promise<void> {
  await client.put('/cost/budget', { daily_limit: dailyLimit, monthly_limit: monthlyLimit });
}
