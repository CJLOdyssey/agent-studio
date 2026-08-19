import { useCallback, useEffect, useState } from 'react';
import { Copy, ChevronLeft } from 'lucide-react';
import { type TraceDetail, fetchTraceDetail } from '../../../../api/client/monitor_events';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';

interface TraceDetailProps {
  traceId: string;
  onBack: () => void;
}

export function TraceDetail({ traceId, onBack }: TraceDetailProps) {
  const { toast } = useToast();
  const [trace, setTrace] = useState<TraceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTrace(await fetchTraceDetail(traceId));
    } catch {
      setTrace(null);
    } finally {
      setLoading(false);
    }
  }, [traceId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch pattern
    load();
  }, [load]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(traceId);
      toast('trace_id 已复制', 'success');
    } catch {
      toast('复制失败', 'error');
    }
  };

  if (loading) return <CardSkeleton count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer" onClick={onBack}>
          <ChevronLeft size={14} /> 返回
        </button>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Trace 详情</h3>
      </div>

      {!trace ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
          未找到该 trace 或已过期
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">{trace.trace_id}</span>
                <button className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] cursor-pointer" onClick={copyId} title="复制 trace_id">
                  <Copy size={13} />
                </button>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span>事件 {trace.total_events ?? 0}</span>
                <span className="text-[var(--color-danger)]">错误 {trace.errors ?? 0}</span>
                <span className="text-[var(--color-warning)]">慢跨度 {trace.slow_spans ?? 0}</span>
              </div>
            </div>
            {trace.suggestion && (
              <p className="mt-3 rounded-md bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] px-3 py-2 text-xs text-[var(--color-warning)]">
                建议：{trace.suggestion}
              </p>
            )}
          </div>

          {(trace.error_events ?? []).length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
              <h4 className="mb-2 text-sm font-medium text-[var(--color-danger)]">错误跨度</h4>
              {trace.error_events!.map((e, i) => (
                <div key={i} className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-text-primary)]">{e.error_type}</span>
                    <span className="text-[var(--color-text-muted)]">{e.logger} · {e.duration_ms != null ? `${e.duration_ms}ms` : '-'}</span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{e.message}</p>
                  {e.error_stack && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-[var(--color-surface-hover)] p-2 text-[10px] text-[var(--color-text-muted)]">{e.error_stack}</pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {(trace.slow_events ?? []).length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
              <h4 className="mb-2 text-sm font-medium text-[var(--color-warning)]">慢跨度 (&gt;1000ms)</h4>
              {trace.slow_events!.map((e, i) => (
                <div key={i} className="flex items-center justify-between border-b border-[var(--color-border)] last:border-b-0 py-2 text-xs">
                  <span className="flex-1 truncate text-[var(--color-text-secondary)]">{e.message}</span>
                  <span className="ml-2 text-[var(--color-text-muted)]">{e.logger}</span>
                  <span className="ml-3 text-[var(--color-warning)]">{e.duration_ms}ms</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}