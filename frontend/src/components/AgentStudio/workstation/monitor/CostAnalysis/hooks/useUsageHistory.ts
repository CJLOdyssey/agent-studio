import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchUsageHistory,
  type CostModelScope,
  type UsageHistoryItem,
  type UsageOrderDir,
  type UsageOrderKey,
} from '../../../../../../api/client/cost';
import { costKeys } from './costQueryKeys';

export interface UseUsageHistoryParams extends CostModelScope {
  page: number;
  pageSize: number;
  /** 服务端模糊过滤 run_id / model（已防抖） */
  search: string;
  order_by: UsageOrderKey;
  order_dir: UsageOrderDir;
}

export interface UseUsageHistoryResult {
  items: UsageHistoryItem[];
  /** 作用域内的总条数（服务端计算，用于真分页） */
  total: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * 使用历史的服务端分页查询。
 *
 * 分页参数参与 queryKey：翻页时保留上一页数据（keepPreviousData）避免闪烁。
 * 注意：切区间/模型换 key 只会造成缓存 miss，并不会重置外部的 page state——
 * 归零由调用方负责（CostAnalysis 在 scope 变化时 setPage(0)）。
 */
export function useUsageHistory({
  page,
  pageSize,
  search,
  order_by,
  order_dir,
  ...scope
}: UseUsageHistoryParams): UseUsageHistoryResult {
  const query = useQuery({
    queryKey: costKeys.usageHistory(scope, pageSize, page * pageSize, search, order_by, order_dir),
    queryFn: () =>
      fetchUsageHistory({
        ...scope,
        limit: pageSize,
        offset: page * pageSize,
        search: search || undefined,
        order_by,
        order_dir,
      }),
    placeholderData: keepPreviousData,
  });

  const total = query.data?.total ?? 0;

  return {
    items: query.data?.history ?? [],
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}
