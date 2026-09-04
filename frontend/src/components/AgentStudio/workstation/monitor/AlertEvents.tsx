import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import {
  type AlertEvent,
  fetchAlertEvents,
  ackAlertEvent,
} from '../../../../api/client/alerts';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';
import { STATUS_LABELS, SEVERITY_LABELS } from './constants';

export function AlertEvents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const queryKey = ['alert-events', { status: statusFilter || undefined, severity: severityFilter || undefined }];

  const { data: events = [], isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchAlertEvents({
      status: statusFilter || undefined,
      severity: severityFilter || undefined,
      limit: 50,
    }),
  });

  const ackMutation = useMutation({
    mutationFn: (eventId: string) => ackAlertEvent(eventId),
    onMutate: async (eventId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AlertEvent[]>(queryKey);
      queryClient.setQueryData<AlertEvent[]>(queryKey, (prev = []) =>
        prev.map((e) => (e.id === eventId ? { ...e, status: 'acked' as const } : e)),
      );
      return { previous };
    },
    onError: (_err, _eventId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      toast('确认失败', 'error');
    },
    onSuccess: () => {
      toast('已确认', 'success');
    },
  });

  const ack = (event: AlertEvent) => ackMutation.mutate(event.id);

  if (isPending) return <CardSkeleton count={3} />;

  if (isError) {
    return (
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-4">
        <p className="text-sm text-[var(--color-danger)]">{error instanceof Error ? error.message : '加载失败'}</p>
        <button className="mt-2 text-xs text-[var(--color-accent)] hover:underline" onClick={() => refetch()}>重试</button>
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
            {Object.entries(SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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
              <tr key={event.id} className={`border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)] ${event.severity === 'P1' && event.status === 'firing' ? 'bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)]' : ''}`}>
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
