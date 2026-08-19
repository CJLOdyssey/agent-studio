import client from './instance';

export interface MonitorEvent {
  timestamp: number | null;
  traceId: string | null;
  spanId: string | null;
  parentSpanId: string | null;
  level: string;
  logger: string;
  message: string;
  errorType: string | null;
  errorStack: string | null;
  durationMs: number | null;
  eventType: string | null;
  tags: unknown;
}

export interface MonitorEventList {
  events: MonitorEvent[];
  total: number;
}

export interface TraceDetail {
  trace_id: string;
  total_events: number;
  errors: number;
  slow_spans: number;
  error_events: Array<{
    level: string;
    message: string;
    error_type: string;
    error_stack: string | null;
    duration_ms: number | null;
    logger: string;
  }>;
  slow_events: Array<{
    message: string;
    duration_ms: number | null;
    logger: string;
  }>;
  suggestion: string | null;
}

export interface ErrorCluster {
  errorType: string;
  logger: string;
  count: number;
  latestMessage: string;
  latestTraceId: string | null;
  latestTimestamp: number | null;
}

export async function fetchMonitorEvents(params?: {
  trace_id?: string;
  q?: string;
  level?: string;
  error_type?: string;
  logger?: string;
  seconds?: number;
  slow?: number;
  limit?: number;
  offset?: number;
}): Promise<MonitorEventList> {
  const resp = await client.get('/monitor/events', { params });
  return resp.data;
}

export async function fetchTraceDetail(traceId: string): Promise<TraceDetail> {
  const resp = await client.get(`/monitor/traces/${traceId}`);
  return resp.data;
}

export async function fetchErrorClusters(params?: {
  seconds?: number;
  limit?: number;
}): Promise<ErrorCluster[]> {
  const resp = await client.get('/monitor/errors/clusters', { params });
  return resp.data.clusters;
}