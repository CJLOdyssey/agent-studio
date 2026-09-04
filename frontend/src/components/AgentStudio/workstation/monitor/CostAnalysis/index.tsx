import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  fetchCostSummary,
  fetchUsageHistoryForExport,
  type CostModelScope,
  type CostScope,
  type UsageOrderDir,
  type UsageOrderKey,
} from '../../../../../api/client/cost';
import { CardSkeleton } from '../../shared/LoadingSkeleton';
import { ErrorBoundary } from '../../shared/ErrorBoundary';
import { RangePresetPicker } from '../shared/RangePresetPicker';
import { useRangePreset } from './hooks/useRangePreset';
import { useIsDarkMode } from '../shared/useIsDarkMode';
import { rangeSpanDays } from '../shared/dateRange';
import { useCostData, COST_REFRESH_MS } from './hooks/useCostData';
import { costKeys } from './hooks/costQueryKeys';
import { useUsageHistory } from './hooks/useUsageHistory';
import { CostMetricCards } from './components/CostMetricCards';
import { CostTrendChart } from './components/CostTrendChart';
import { UsageHistoryTable, USAGE_PAGE_SIZE } from './components/UsageHistoryTable';
import { BudgetPanel } from './components/BudgetPanel';
import { PricingReference } from './components/PricingReference';
import { ModelPicker } from './components/ModelPicker';
import { KeyPicker } from './components/KeyPicker';
import { listKeys } from '../../../../../api/client/keys';
import { EmptyState, ErrorState, PartialErrorBanner } from './components/states';
import { calculateCostMetrics, exportToCsv } from './utils/costUtils';
import { useToast } from '../../../../../utils/useToast';

interface CostAnalysisProps {
  teamId?: string;
}

export function CostAnalysis({ teamId }: CostAnalysisProps) {
  const isDark = useIsDarkMode();
  const { toast } = useToast();
  const { preset, range, granularity, customRange, selectPreset, applyCustom } = useRangePreset('last7');

  // URL 同步是分析工具的标配：可分享、可刷新保持。replacestate 防导航历史堆积。
  const [searchParams, setSearchParams] = useSearchParams();
  const modelFromUrl = searchParams.get('model') ?? '';
  const userFromUrl = searchParams.get('user') ?? '';
  const nodeFromUrl = searchParams.get('node') ?? '';
  const keyFromUrl = searchParams.get('key') ?? '';
  const [selectedModel, setSelectedModel] = useState<string>(modelFromUrl);
  const [selectedUser, setSelectedUser] = useState<string>(userFromUrl);
  const [selectedNode, setSelectedNode] = useState<string>(nodeFromUrl);
  const [selectedKey, setSelectedKey] = useState<string>(keyFromUrl);
  const [page, setPage] = useState(0);
  // 搜索/排序：服务端查询参数，状态归属此处（数据在此获取）；表格受控视图
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<{ key: UsageOrderKey; dir: UsageOrderDir }>({
    key: 'timestamp',
    dir: 'desc',
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // scope 是 UI 状态与 URL 的并集（DRY：所有 hook 都基于同一个 scope，避免 N 份独立）
  const scope = useMemo<CostModelScope>(
    () => ({
      teamId,
      range,
      model: selectedModel || undefined,
      userId: selectedUser || undefined,
      nodeId: selectedNode || undefined,
      keyId: selectedKey || undefined,
    }),
    [teamId, range, selectedModel, selectedUser, selectedNode, selectedKey],
  );

  const { summary, dailyTrend, isLoading, isFetching, failedSources, refetch } =
    useCostData(scope, granularity);

  const usage = useUsageHistory({
    ...scope,
    page,
    pageSize: USAGE_PAGE_SIZE,
    search,
    order_by: order.key,
    order_dir: order.dir,
  });

  // 当前用户的密钥列表：供 KeyPicker 下拉 + 面包屑回显密钥名（共享 ['keys'] 缓存）
  const { data: keyItems = [] } = useQuery({
    queryKey: ['keys'],
    queryFn: listKeys,
  });
  const selectedKeyLabel = keyItems.find((k) => k.id === selectedKey)?.label;
  const selectedKeyDisplay = selectedKeyLabel || selectedKey || '';

  // 作用域变化时显式回第一页并清搜索：queryKey 含 offset/search，切模型/密钥/区间/
  // 用户维度若停留旧页码或旧关键词，会拿越界 offset 请求新作用域得空表
  // （react-query 换 key 不会重置外部 state）。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 作用域驱动的分页重置（见 WorkflowList）
    setPage(0);
    setSearchInput('');
    setSearch('');
  }, [scope]);

  // URL 同步（不重复写）：写 URL 的 helper。注意不在 useEffect 里反向往 setState，
  // 那样会循环——初始读 URL → 后续写入由 UI 状态驱动（单一数据源）。
  const pushScope = useCallback(
    (next: { model?: string; user?: string; node?: string; key?: string }) => {
      const params = new URLSearchParams(searchParams);
      if (next.model) params.set('model', next.model);
      else params.delete('model');
      if (next.user) params.set('user', next.user);
      else params.delete('user');
      if (next.node) params.set('node', next.node);
      else params.delete('node');
      if (next.key) params.set('key', next.key);
      else params.delete('key');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // 模型选项必须来自「不带 model 过滤」的全集：选中某模型后下拉里就只剩它自己，
  // 想切别的得先绕回“所有模型”。model 为空时此查询与 useCostData summary 同 key，
  // 自动共享缓存不重复请求。
  const modelsScope = useMemo<CostScope>(() => ({ teamId, range }), [teamId, range]);
  const { data: unscopedSummary } = useQuery({
    queryKey: costKeys.summary({ ...modelsScope }),
    queryFn: () => fetchCostSummary({ ...modelsScope }),
    refetchInterval: COST_REFRESH_MS,
  });

  const spanDays = useMemo(() => rangeSpanDays(range), [range]);

  const modelOptions = useMemo(
    () => (unscopedSummary ? Object.keys(unscopedSummary.by_model).sort() : []),
    [unscopedSummary],
  );

  const metrics = useMemo(
    () => (summary ? calculateCostMetrics(summary, spanDays) : null),
    [summary, spanDays],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value.trim());
      setPage(0);
    }, 300);
  }, []);

  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );

  const handleSortChange = useCallback((key: UsageOrderKey) => {
    setOrder((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' },
    );
    setPage(0);
  }, []);

  const handleExportAll = useCallback(async () => {
    try {
      const rows = await fetchUsageHistoryForExport({ ...scope, search: search || undefined });
      if (rows.length === 0) {
        toast('当前筛选条件下没有可导出的记录', 'info');
        return;
      }
      exportToCsv(rows);
    } catch (err) {
      toast(err instanceof Error ? err.message : '导出失败', 'error');
    }
  }, [scope, search, toast]);

  const content = () => {
    if (isLoading) return <CardSkeleton count={4} />;

    if (!summary || !metrics) {
      const firstError = failedSources.length > 0 ? failedSources.join('、') : '成本数据';
      return <ErrorState message={`${firstError}加载失败`} onRetry={refetch} />;
    }

    const isEmpty = summary.total_calls === 0 && dailyTrend.length === 0;
    // 过滤态下空数据集 ≠ 无数据（LSP：空态文案必须真实反映原因，避免用户误判）
    const hasFilter = Boolean(selectedModel || selectedUser || selectedNode || selectedKey);
    const emptyTitle = hasFilter ? '当前过滤条件下没有成本记录' : '暂无成本数据';
    const emptyDesc = hasFilter
      ? '请调整或清除过滤条件后再试'
      : '开始对话后将自动生成成本分析';

    return (
      <div className="space-y-8">
        {failedSources.length > 0 && (
          <PartialErrorBanner sources={failedSources} onRetry={refetch} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <RangePresetPicker
            preset={preset}
            onPresetChange={selectPreset}
            customRange={customRange}
            onCustomApply={applyCustom}
          />
          <div className="flex flex-wrap items-center gap-2">
            <KeyPicker
              value={selectedKey}
              onChange={(id) => {
                setSelectedKey(id);
                pushScope({ key: id || undefined });
              }}
              isFetching={isFetching}
            />
            <ModelPicker models={modelOptions} value={selectedModel} onChange={setSelectedModel} isFetching={isFetching} />
          </div>
        </div>

        {/* 过滤器面包屑：单一事实源 (DRY) — 选中的 model/user 来自 scope
        */}
        {(selectedModel || selectedUser || selectedNode || selectedKey) && (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <span>过滤条件：</span>
            {selectedKey && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-0.5">
                密钥 · {selectedKeyDisplay}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKey('');
                    pushScope({ key: undefined });
                  }}
                  aria-label="清除密钥过滤"
                  className="opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            )}
            {selectedModel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-0.5">
                模型 · {selectedModel}
                <button
                  type="button"
                  onClick={() => setSelectedModel('')}
                  aria-label="清除模型过滤"
                  className="opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            )}
            {selectedUser && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-0.5">
                用户 · {selectedUser}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser('');
                    pushScope({ user: undefined });
                  }}
                  aria-label="清除用户过滤"
                  className="opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            )}
            {selectedNode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] px-2 py-0.5">
                节点 · {selectedNode}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNode('');
                    pushScope({ node: undefined });
                  }}
                  aria-label="清除节点过滤"
                  className="opacity-70 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}

        {isEmpty ? (
          <EmptyState title={emptyTitle} description={emptyDesc} />
        ) : (
          <>
            <CostMetricCards summary={summary} metrics={metrics} />

            <BudgetPanel
              onError={(msg) => toast(msg, 'error')}
              onSaved={() => toast('预算已保存', 'success')}
            />

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6 shadow-sm">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">成本趋势</h3>
              <div className="mt-4">
                <CostTrendChart data={dailyTrend} isDark={isDark} granularity={granularity} />
              </div>
            </div>

            <UsageHistoryTable
              items={usage.items}
              total={usage.total}
              page={page}
              isFetching={usage.isFetching}
              searchInput={searchInput}
              order={order}
              onSearchChange={handleSearchChange}
              onSortChange={handleSortChange}
              onPageChange={setPage}
              onExportAll={handleExportAll}
            />

            <PricingReference />
          </>
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary fallback={<CardSkeleton count={4} />}>{content()}</ErrorBoundary>
  );
}