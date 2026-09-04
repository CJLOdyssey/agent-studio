import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { fetchTrace, type TraceSpan } from '../../../../../api/client/traces';
import { ErrorState } from '../CostAnalysis/components/states';
import { formatCost, formatTokens } from '../shared/format';
import { SpanRow, StatusBadge, RelTime, ms } from './TraceSpanRow';

interface LLMTraceDetailProps {
  runId: string;
  onBack: () => void;
}

interface Node {
  root: TraceSpan;
  children: TraceSpan[];
}

function shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** 长 ID 中间截断，非末位省略——一眼看出是哪种 ID 且可悬停全称。 */
function midClip(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** 归属 ID 胶囊：中间截断 ID + 独立复制按钮；label 由外层格子提供（避免重复宽占位）。 */
function IdChip({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="font-mono text-[12px] text-[var(--color-text-muted)]">—</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-[12px] text-[var(--color-text-secondary)]" title={value}>
        {midClip(value)}
      </span>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
        aria-label="复制 ID"
        title="复制完整 ID"
        className={`inline-flex shrink-0 cursor-pointer items-center rounded-md bg-[var(--color-surface-hover)] p-1 transition-colors hover:bg-[var(--color-accent)] hover:text-white ${copied ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}`}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
}

export function LLMTraceDetail({ runId, onBack }: LLMTraceDetailProps) {
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['llm-trace', runId],
    queryFn: () => fetchTrace(runId),
  });

  const { roots, meta, agg, startIso } = useMemo(() => {
    const spans = data?.spans ?? [];
    const byId = new Map(spans.map((s) => [s.id, s]));
    const rootsArr: Node[] = [];
    const childMap = new Map<string, TraceSpan[]>();
    for (const s of spans) {
      if (!s.parentSpanId || !byId.has(s.parentSpanId)) {
        rootsArr.push({ root: s, children: [] });
      } else {
        const list = childMap.get(s.parentSpanId) ?? [];
        list.push(s);
        childMap.set(s.parentSpanId, list);
      }
    }
    const aggArr = { totalTokens: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, durationMs: 0, errorSpans: 0, models: new Set<string>() };
    let earliest: string | null = null;
    for (const s of spans) {
      aggArr.totalTokens += s.totalTokens;
      aggArr.promptTokens += s.promptTokens;
      aggArr.completionTokens += s.completionTokens;
      aggArr.costUsd += s.costUsd;
      aggArr.durationMs += s.durationMs;
      if (s.status === 'error') aggArr.errorSpans += 1;
      if (s.model) aggArr.models.add(s.model);
      if (s.createdAt && (!earliest || s.createdAt < earliest)) earliest = s.createdAt;
    }
    for (const n of rootsArr) {
      n.children = childMap.get(n.root.id) ?? [];
    }
    const metaRoot = spans[0];
    return {
      roots: rootsArr,
      meta: metaRoot
        ? { sessionId: metaRoot.sessionId, teamId: metaRoot.teamId, userId: metaRoot.userId, keyId: metaRoot.keyId, status: metaRoot.status }
        : { sessionId: null, teamId: null, userId: null, keyId: null, status: null },
      agg: aggArr,
      startIso: earliest,
    };
  }, [data]);

  const hasData = (data?.spans?.length ?? 0) > 0;
  const [copiedId, setCopiedId] = useState(false);
  const isErr = agg.errorSpans > 0;
  const status: TraceSpan['status'] = isErr ? 'error' : meta.status ?? 'success';

  return (
    <div className="space-y-4">
      {/* 顶部工具条：返回 / trace 名+id+复制 / 刷新(icon) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
        >
          ← 返回列表
        </button>
        <div className="ml-1 flex min-w-0 items-center gap-2">
          <span className="font-semibold text-[var(--color-text-primary)]">Trace</span>
          <span className="truncate font-mono text-[13px] text-[var(--color-text-secondary)]" title={runId}>
            {shortId(runId)}
          </span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(runId).then(() => {
                setCopiedId(true);
                window.setTimeout(() => setCopiedId(false), 1200);
              });
            }}
            aria-label="复制 trace ID"
            title="复制完整 trace ID"
            className="shrink-0 cursor-pointer text-[var(--color-text-muted)] opacity-50 transition-opacity hover:opacity-100 hover:text-[var(--color-accent)]"
          >
            {copiedId ? <Check size={13} className="text-[var(--color-success)]" /> : <Copy size={13} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          aria-label="刷新"
          title="刷新"
          className={`ml-auto inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] ${isFetching ? 'pointer-events-none' : ''}`}
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {isError ? (
        <ErrorState message="Trace 加载失败" onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="p-10 text-center text-sm text-[var(--color-text-muted)]">加载中…</div>
      ) : !hasData ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-10 text-center text-sm text-[var(--color-text-muted)]">
          该 run 暂无 span 记录
        </div>
      ) : (
        <>
          {/* 元数据卡：标准 6 列表格，整列统一左对齐，状态置于表头右侧 */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-sm">
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold text-[var(--color-text-primary)]">运行概览</span>
                  {startIso && (
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      <RelTime iso={startIso} />
                    </span>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>
            </div>
            {/* 主模型行：模型名独占整行、允许换行完整显示（根治截断） */}
            <div className="border-t border-[var(--color-border)]/50 px-5 py-3">
              <div className="text-[11px] text-[var(--color-text-muted)]">模型</div>
              <div className="mt-1 break-words text-[13px] font-medium leading-snug text-[var(--color-text-primary)]">
                {agg.models.size ? [...agg.models].join(' · ') : '—'}
              </div>
            </div>
            {/* 指标横条：固定 label 宽对齐，间距统一，数字列等宽不松散 */}
            <div className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-t border-[var(--color-border)]/50 px-5 py-3">
              {[
                { label: '总耗时', value: ms(agg.durationMs), num: true },
                { label: 'Token', value: formatTokens(agg.totalTokens), num: true },
                { label: '成本', value: formatCost(agg.costUsd), num: true },
                { label: 'Span', value: String(data?.spans?.length ?? 0), num: true },
                { label: '输入/输出', value: `${formatTokens(agg.promptTokens)} / ${formatTokens(agg.completionTokens)} tok`, num: true },
              ].map((it) => (
                <div key={it.label} className="flex items-baseline gap-2">
                  <span className="text-[11px] text-[var(--color-text-muted)]">{it.label}</span>
                  <span className={`whitespace-nowrap text-[13px] font-medium text-[var(--color-text-primary)] ${it.num ? 'tabular-nums' : ''}`}>
                    {it.value}
                  </span>
                </div>
              ))}
            </div>

            {/* 归属：复用顶部表格语义，三列等宽，label 上 ID 下，与数据列同构、不再孤行独宽 */}
            <div className="border-t border-[var(--color-border)] px-5 py-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">Session</span>
                  <IdChip value={meta.sessionId} />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">用户</span>
                  <IdChip value={meta.userId} />
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">密钥</span>
                  <IdChip value={meta.keyId} />
                </div>
              </div>
            </div>
          </div>

          {/* 瀑布 */}
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-sm">
            <div className="flex items-center border-b border-[var(--color-border)] px-4 py-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">Span 瀑布</span>
              <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">{data?.spans?.length ?? 0} 个</span>
            </div>
            {roots.map((n) => (
              <div key={n.root.id}>
                <SpanRow span={n.root} depth={0} displayName={data?.title ?? undefined} />
                {n.children.map((c) => (
                  <SpanRow key={c.id} span={c} depth={1} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
