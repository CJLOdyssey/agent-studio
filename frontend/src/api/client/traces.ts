import client from './instance';

export interface TraceSpan {
  id: string;
  runId: string;
  parentSpanId: string | null;
  spanType: 'agent' | 'chat' | 'node' | 'llm' | 'tool';
  nodeId: string;
  model: string;
  /** 元数据（agent/root span 自带；后端补充输出后前端展示用） */
  sessionId?: string | null;
  teamId?: string | null;
  userId?: string | null;
  keyId?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  status: 'success' | 'error' | 'running';
  error: string | null;
  inputSnapshot: string | null;
  outputSnapshot: string | null;
  createdAt: string | null;
}

export interface TraceSummary {
  runId: string;
  /** 该 run 的可读名称（来自 project_runs.requirement，即用户本次提交原文）；无则前端回退 runId。 */
  title?: string | null;
  spanCount: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
  lastAt: string | null;
  errorSpans: number;
  hasError: boolean;
}

export interface TraceListPage {
  traces: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** 拉取按 run 分组的 trace 列表（含聚合指标）。 */
export async function fetchTraces(params: {
  startDate?: string;
  endDate?: string;
  runId?: string;
  offset?: number;
  limit?: number;
}): Promise<TraceListPage> {
  const q: Record<string, string | number | undefined> = {
    start_date: params.startDate || undefined,
    end_date: params.endDate || undefined,
    // 后端 list 路由读的是 run_id（FastAPI query 参数名）
    run_id: params.runId || undefined,
    offset: params.offset ?? 0,
    limit: params.limit ?? 50,
  };
  const resp = await client.get('/traces', { params: q });
  return resp.data;
}

export interface TraceDetail {
  runId: string;
  /** 该 trace 的展示名 = run 的用户需求原文；无则 null（前端根 span 回退 node_id）。 */
  title?: string | null;
  spans: TraceSpan[];
}

/** 拉取单个 run 的完整 span 集合（详情瀑布用）。 */
export async function fetchTrace(runId: string): Promise<TraceDetail> {
  const resp = await client.get(`/traces/${encodeURIComponent(runId)}`);
  return resp.data;
}
