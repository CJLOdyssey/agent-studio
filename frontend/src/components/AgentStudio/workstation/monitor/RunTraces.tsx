import { useCallback, useEffect, useState } from 'react';
import { FileSearch, Bug } from 'lucide-react';
import {
  type MonitorEvent,
  fetchMonitorEvents,
  fetchErrorClusters,
  type ErrorCluster,
} from '../../../../api/client/monitor_events';
import { CardSkeleton } from '../shared/LoadingSkeleton';

const LEVEL_STYLE: Record<string, string> = {
  error: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  info: 'text-[var(--color-text-secondary)]',
  debug: 'text-[var(--color-text-muted)]',
  critical: 'text-[var(--color-danger)]',
};

interface RunTracesProps {
  onSelectTrace: (traceId: string) => void;
}

export function RunTraces({ onSelectTrace }: RunTracesProps) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [clusters, setClusters] = useState<ErrorCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState('');
  const [errorFilter, setErrorFilter] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const [list, clusterData] = await Promise.all([
        fetchMonitorEvents({
          level: levelFilter || undefined,
          error_type: errorFilter || undefined,
          q: search || undefined,
          seconds: 86400,
          limit: 50,
        }),
        fetchErrorClusters({ seconds: 86400 }),
      ]);
      setEvents(list.events);
      setTotal(list.total);
      setClusters(clusterData);
    } catch {
      setEvents([]);
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, errorFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch pattern
    load();
  }, [load]);

  if (loading) return <CardSkeleton count={3} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">运行轨迹 / 事件</h3>
        <div className="flex items-center gap-2">
          <input
            placeholder="搜索..."
            className="w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)]" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="">全部级别</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
            <option value="critical">critical</option>
          </select>
        </div>
      </div>

      {/* 失败聚类 */}
      {clusters.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bug size={14} className="text-[var(--color-warning)]" />
            <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">失败聚类</h4>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {clusters.slice(0, 6).map((c) => (
              <button
                key={`${c.errorType}-${c.logger}`}
                onClick={() => { setErrorFilter(c.errorType); }}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left hover:bg-[var(--color-surface-hover)] cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--color-text-primary)]">{c.errorType}</span>
                  <span className="rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-1.5 text-[var(--color-danger)]">{c.count}</span>
                </div>
                <p className="mt-1 truncate text-[10px] text-[var(--color-text-muted)]">{c.latestMessage}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
          <span className="text-xs text-[var(--color-text-muted)]">共 {total} 条</span>
        </div>
        {events.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">暂无事件</div>
        )}
        {events.map((ev, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[var(--color-border)] last:border-b-0 px-4 py-2.5 hover:bg-[var(--color-surface-hover)]">
            <span className={`text-xs ${LEVEL_STYLE[ev.level] ?? ''}`}>{ev.level}</span>
            <span className="text-xs text-[var(--color-text-muted)] w-24 truncate">{ev.logger}</span>
            <span className="flex-1 truncate text-sm text-[var(--color-text-secondary)]">{ev.message}</span>
            {ev.errorType && <span className="rounded bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] px-1.5 text-[10px] text-[var(--color-danger)]">{ev.errorType}</span>}
            {ev.durationMs != null && ev.durationMs >= 1000 && (
              <span className="text-[10px] text-[var(--color-warning)]">{ev.durationMs}ms</span>
            )}
            {ev.traceId && (
              <button
                onClick={() => onSelectTrace(ev.traceId!)}
                className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
                title={`查看 trace: ${ev.traceId}`}
              >
                <FileSearch size={13} /> trace
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}