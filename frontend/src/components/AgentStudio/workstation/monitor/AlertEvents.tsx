import { useCallback, useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import {
  type AlertEvent,
  fetchAlertEvents,
  ackAlertEvent,
} from '../../../../api/client/alerts';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';

const STATUS_LABELS: Record<string, string> = {
  firing: '触发中', resolved: '已恢复', acked: '已确认',
};

export function AlertEvents() {
  const { toast } = useToast();
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const load = useCallback(async () => {
    try {
      setEvents(await fetchAlertEvents({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: 50,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch pattern (see WorkflowList)
    load();
  }, [load]);

  const ack = async (event: AlertEvent) => {
    try {
      await ackAlertEvent(event.id);
      await load();
      toast('已确认', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '确认失败', 'error');
    }
  };

  if (loading) return <CardSkeleton count={3} />;

  if (error) {
    return (
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-4">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
        <button className="mt-2 text-xs text-[var(--color-accent)] hover:underline" onClick={load}>重试</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">触发历史</h3>
        <div className="flex items-center gap-2">
          <select className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-primary)]" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="">全部级别</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-4 py-3 font-medium">规则</th>
              <th className="px-4 py-3 font-medium">触发值</th>
              <th className="px-4 py-3 font-medium">级别</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">消息</th>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]">
                <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{event.ruleName}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {event.metricValue} / 阈值 {event.threshold}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    event.severity === 'P1' ? 'bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]'
                    : event.severity === 'P2' ? 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
                  }`}>
                    {event.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{STATUS_LABELS[event.status] ?? event.status}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[280px] truncate" title={event.message}>{event.message}</td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">{new Date(event.triggeredAt).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    {event.status !== 'acked' && (
                      <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" onClick={() => ack(event)}>
                        <CheckCheck size={13} /> 确认
                      </button>
                    )}
                    {event.status === 'acked' && <span className="text-xs text-[var(--color-text-muted)]">已确认</span>}
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">暂无事件</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}