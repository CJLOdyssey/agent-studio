import type {
  CostModelScope,
  CostScope,
  TrendScope,
  UsageOrderDir,
  UsageOrderKey,
} from '../../../../../../api/client/cost';

/**
 * 成本页全部查询键的集中定义。
 *
 * 键里带上作用域（team / 区间 / 模型 / 粒度），切换筛选时 react-query 才能
 * 命中缓存或正确失效，避免手写 hook 时代的竞态与重复请求。
 */
export const costKeys = {
  all: ['cost'] as const,
  summary: ({ teamId, range, model, userId, nodeId, keyId }: CostModelScope) =>
    [
      'cost',
      'summary',
      teamId ?? null,
      range.start,
      range.end,
      model ?? null,
      userId ?? null,
      nodeId ?? null,
      keyId ?? null,
    ] as const,
  dailyTrend: ({
    teamId,
    range,
    model,
    granularity,
    userId,
    nodeId,
    keyId,
  }: TrendScope) =>
    [
      'cost',
      'daily-trend',
      teamId ?? null,
      range.start,
      range.end,
      model ?? null,
      userId ?? null,
      nodeId ?? null,
      keyId ?? null,
      granularity,
    ] as const,
  usageHistory: (
    { teamId, range, model, userId, nodeId, keyId }: CostModelScope,
    limit: number,
    offset: number,
    search = '',
    order_by: UsageOrderKey = 'timestamp',
    order_dir: UsageOrderDir = 'desc',
  ) =>
    [
      'cost',
      'usage-history',
      teamId ?? null,
      range.start,
      range.end,
      model ?? null,
      userId ?? null,
      nodeId ?? null,
      keyId ?? null,
      limit,
      offset,
      search,
      order_by,
      order_dir,
    ] as const,
  budget: () => ['cost', 'budget'] as const,
};

export type CostScopeKey = readonly unknown[];

/** 供性能页复用的窗口键片段（保持与成本页一致的缓存语义）。 */
export function scopeKeyPart({ teamId, range }: CostScope): readonly unknown[] {
  return [teamId ?? null, range.start, range.end];
}
