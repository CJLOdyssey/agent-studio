import { useCallback, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  fetchCostSummary,
  fetchDailyTrend,
  fetchBudgetStatus,
  type CostModelScope,
  type CostSummary,
  type DailyTrendItem,
  type BudgetStatus,
  type TrendGranularity,
} from '../../../../../../api/client/cost';
import { costKeys } from './costQueryKeys';

interface UseCostDataResult {
  summary: CostSummary | null;
  dailyTrend: DailyTrendItem[];
  budget: BudgetStatus | null;
  /** 首次加载（还没有任何数据可展示） */
  isLoading: boolean;
  /** 任意请求正在进行中（用于「刷新中」提示） */
  isFetching: boolean;
  /** 按数据源维度的错误，用于局部降级而不是整页报错 */
  errors: Partial<Record<'summary' | 'dailyTrend' | 'budget', Error>>;
  failedSources: string[];
  refetch: () => void;
}

const SOURCE_LABELS = {
  summary: '成本概览',
  dailyTrend: '成本趋势',
  budget: '预算状态',
} as const;

/** 自动刷新间隔（与 MonitorCenter 顶部保持一致，整页同节奏）。 */
export const COST_REFRESH_MS = 60_000;

/**
 * 成本页数据聚合。
 *
 * 相比此前的手写 hook（Promise.allSettled 静默吞掉失败、error 永不触发）：
 * - 每个数据源独立暴露 error，单个接口挂掉时其余区块照常渲染；
 * - 缓存、去重、竞态、重试交给 react-query。
 */
export function useCostData(scope: CostModelScope, granularity: TrendGranularity): UseCostDataResult {
  const [summaryQuery, trendQuery, budgetQuery] = useQueries({
    queries: [
      {
        queryKey: costKeys.summary(scope),
        queryFn: () => fetchCostSummary(scope),
        refetchInterval: COST_REFRESH_MS,
      },
      {
        queryKey: costKeys.dailyTrend({ ...scope, granularity }),
        queryFn: () => fetchDailyTrend({ ...scope, granularity }),
        refetchInterval: COST_REFRESH_MS,
      },
      {
        queryKey: costKeys.budget(),
        queryFn: fetchBudgetStatus,
        refetchInterval: COST_REFRESH_MS,
      },
    ],
  });

  const errors = useMemo(() => {
    const result: UseCostDataResult['errors'] = {};
    if (summaryQuery.error) result.summary = summaryQuery.error as Error;
    if (trendQuery.error) result.dailyTrend = trendQuery.error as Error;
    if (budgetQuery.error) result.budget = budgetQuery.error as Error;
    return result;
  }, [summaryQuery.error, trendQuery.error, budgetQuery.error]);

  const failedSources = useMemo(
    () => (Object.keys(errors) as (keyof typeof SOURCE_LABELS)[]).map((k) => SOURCE_LABELS[k]),
    [errors],
  );

  const refetch = useCallback(() => {
    summaryQuery.refetch();
    trendQuery.refetch();
    budgetQuery.refetch();
  }, [summaryQuery, trendQuery, budgetQuery]);

  return {
    summary: summaryQuery.data ?? null,
    dailyTrend: trendQuery.data ?? [],
    budget: budgetQuery.data ?? null,
    isLoading: summaryQuery.isPending || trendQuery.isPending,
    isFetching: summaryQuery.isFetching || trendQuery.isFetching,
    errors,
    failedSources,
    refetch,
  };
}
