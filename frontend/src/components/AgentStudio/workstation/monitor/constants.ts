export const SEVERITY_LABELS: Record<string, string> = {
  P1: 'P1(紧急)', P2: 'P2(工单)', P3: 'P3(信息)',
};

export const METRIC_LABELS: Record<string, string> = {
  success_rate: '成功率',
  p95_latency: 'P95 延迟(s)',
  avg_latency: '平均延迟(s)',
  daily_cost: '日成本($)',
  error_count: '错误次数',
};

export const OPERATOR_LABELS: Record<string, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤',
};

export const STATUS_LABELS: Record<string, string> = {
  firing: '触发中', resolved: '已恢复', acked: '已确认',
};

export const INPUT_CLASS = 'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]';

export function formatWindow(seconds: number): string {
  if (seconds >= 86400) {
    const d = seconds / 86400;
    return d === Math.floor(d) ? `${d}d` : `${(seconds / 3600).toFixed(1)}h`;
  }
  if (seconds >= 3600) {
    const h = seconds / 3600;
    return h === Math.floor(h) ? `${h}h` : `${(seconds / 60).toFixed(0)}m`;
  }
  if (seconds >= 60) return `${seconds / 60}m`;
  return `${seconds}s`;
}
