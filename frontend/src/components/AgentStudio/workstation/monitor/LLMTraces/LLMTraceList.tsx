import { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchTraces, type TraceSummary } from '../../../../../api/client/traces';
import { EmptyState, ErrorState } from '../CostAnalysis/components/states';
import { useRangePreset } from '../CostAnalysis/hooks/useRangePreset';
import { RangePresetPicker } from '../shared/RangePresetPicker';
import WstaPagination from '../../shared/WstaPagination';
import { formatCost, formatDateTime, formatTokens } from '../shared/format';

interface LLMTraceListProps {
  onOpenTrace: (runId: string) => void;
}

const PAGE_SIZE = 20;

function statusBadgeClass(hasError: boolean): string {
  return hasError
    ? 'bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]'
    : 'bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]';
}

export function LLMTraceList({ onOpenTrace }: LLMTraceListProps) {
  // 范围用与成本/性能一致的预设下拉驱动（今天/昨天/近7天/近30天/本月/上月/自定义）
  const { preset, range, customRange, selectPreset, applyCustom } = useRangePreset('today');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const selectRange = (p: Parameters<typeof selectPreset>[0]) => {
    selectPreset(p);
    setPage(1);
  };
  const applyCustomRange = (r: { start: string; end: string }) => {
    applyCustom(r);
    setPage(1);
  };
  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['llm-traces', range.start, range.end, page, search],
    queryFn: () =>
      fetchTraces({ startDate: range.start, endDate: range.end, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, runId: search.trim() || undefined }),
    placeholderData: (prev) => prev,
  });

  const traces = useMemo(() => data?.traces ?? [], [data]);
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* 头部工具条：日期范围预设（与成本/性能一致）+ 检索 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangePresetPicker
          preset={preset}
          onPresetChange={selectRange}
          customRange={customRange}
          onCustomApply={applyCustomRange}
        />
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              placeholder="按 run ID 检索"
              className="w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-3 py-1.5 pr-8 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
            {search && (
              <button
                onClick={() => changeSearch('')}
                aria-label="清空搜索"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 列表卡片 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-sm overflow-hidden">
        {isError ? (
          <ErrorState message="运行轨迹加载失败" onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="p-10 text-center text-sm text-[var(--color-text-muted)]">加载中…</div>
        ) : traces.length === 0 ? (
          <EmptyState
            title={search ? '未找到匹配的运行' : '暂无运行轨迹'}
            description={search ? '换一个 run ID 试试，或清除检索' : '产生 LLM 调用后会自动记录 trace'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                  <th className="px-4 py-3 font-medium text-left">用户消息</th>
                  <th className="px-4 py-3 font-medium text-left">时间 / ID</th>
                  <th className="px-4 py-3 font-medium text-center">调用数</th>
                  <th className="px-4 py-3 font-medium text-center">Token</th>
                  <th className="px-4 py-3 font-medium text-center">成本</th>
                  <th className="px-4 py-3 font-medium text-center">耗时</th>
                  <th className="px-4 py-3 font-medium text-center">状态</th>
                </tr>
              </thead>
              <tbody>
                {traces.map((t: TraceSummary) => (
                  <TraceRow key={t.runId} trace={t} onOpen={() => onOpenTrace(t.runId)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isPending && !isError && total > PAGE_SIZE && (
          <WstaPagination
            embedded
            current={page}
            pageSize={PAGE_SIZE}
            total={total}
            showCount
            onChange={(p) => setPage(p)}
          />
        )}
      </div>
    </div>
  );
}

function TraceRow({ trace, onOpen }: { trace: TraceSummary; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-[var(--color-border)]/60 last:border-0 hover:bg-[var(--color-surface-hover)] transition-colors"
    >
      <td className="px-4 py-3 text-left">
        <div
          className="text-sm font-medium text-[var(--color-text-primary)] truncate"
          title={trace.title ?? trace.runId}
        >
          {trace.title || trace.runId.slice(0, 12)}
        </div>
      </td>
      <td className="px-4 py-3 text-left">
        <div className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
          {trace.lastAt ? formatDateTime(trace.lastAt) : '—'}
        </div>
        <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-muted)]">
          <span className="truncate" title={trace.runId}>
            {trace.runId}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation(); // 避免触发整行打开详情
              void navigator.clipboard.writeText(trace.runId).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              });
            }}
            aria-label="复制 run ID"
            title="复制 run ID"
            className="shrink-0 cursor-pointer text-[var(--color-text-muted)] opacity-60 transition-opacity hover:opacity-100 hover:text-[var(--color-accent)]"
          >
            {copied ? <Check size={12} className="text-[var(--color-success)]" /> : <Copy size={12} />}
          </button>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-sm text-[var(--color-text-secondary)]">{trace.spanCount}</td>
      <td className="px-4 py-3 text-center text-sm text-[var(--color-text-secondary)]">
        {formatTokens(trace.totalTokens)}
        <span className="ml-1 text-xs text-[var(--color-text-muted)]">tok</span>
      </td>
      <td className="px-4 py-3 text-center text-sm font-medium text-[var(--color-text-primary)]">
        {formatCost(trace.costUsd)}
      </td>
      <td className="px-4 py-3 text-center text-sm text-[var(--color-text-secondary)]">
        {trace.durationMs >= 1000
          ? `${(trace.durationMs / 1000).toFixed(1)}s`
          : `${Math.round(trace.durationMs)}ms`}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
            trace.hasError,
          )}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              trace.hasError ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'
            }`}
          />
          {trace.hasError ? `${trace.errorSpans} 个错误` : '正常'}
        </span>
      </td>
    </tr>
  );
}
