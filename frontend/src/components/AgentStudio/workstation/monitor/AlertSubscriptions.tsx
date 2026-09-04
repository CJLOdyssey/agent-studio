import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSubscriptions, replaceSubscriptions, type Subscription } from '../../../../api/client/alerts';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';
import { SEVERITY_LABELS } from './constants';

const SUBSCRIPTIONS_KEY = ['alert-subscriptions'] as const;

export function AlertSubscriptions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: subs = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: SUBSCRIPTIONS_KEY,
    queryFn: fetchSubscriptions,
  });

  const saveMutation = useMutation({
    mutationFn: (subscriptions: Subscription[]) => replaceSubscriptions(subscriptions),
    onSuccess: (result) => {
      queryClient.setQueryData(SUBSCRIPTIONS_KEY, result);
      toast('订阅已保存', 'success');
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    },
  });

  const toggle = (severity: string) => {
    queryClient.setQueryData<Subscription[]>(SUBSCRIPTIONS_KEY, (prev) => {
      const current = prev ?? [];
      const existing = current.find((s) => s.severity === severity);
      if (existing) {
        return current.map((s) => (s.severity === severity ? { ...s, enabled: !s.enabled } : s));
      }
      return [...current, { severity, teamId: null, enabled: true }];
    });
  };

  const save = () => {
    saveMutation.mutate(subs.filter((s) => s.enabled));
  };

  if (isPending) return <CardSkeleton count={2} />;

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
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">通知订阅</h3>
        <button className="px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50" disabled={saveMutation.isPending} onClick={save}>
          {saveMutation.isPending ? '保存中...' : '保存订阅'}
        </button>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">选择你要接收的告警级别，保存后生效。</p>

      <div className="space-y-2">
        {Object.keys(SEVERITY_LABELS).map((sev) => {
          const sub = subs.find((s) => s.severity === sev);
          const on = sub?.enabled ?? false;
          return (
            <label key={sev} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-4 py-3 cursor-pointer">
              <span className="text-sm text-[var(--color-text-primary)]">{SEVERITY_LABELS[sev]}</span>
              <button
                role="switch"
                aria-checked={on}
                aria-label={`${SEVERITY_LABELS[sev]} 通知`}
                onClick={() => toggle(sev)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${on ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-hover)]'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-1'}`} />
              </button>
            </label>
          );
        })}
      </div>
    </div>
  );
}
