import { useCallback, useEffect, useState } from 'react';
import { fetchSubscriptions, replaceSubscriptions, type Subscription } from '../../../../api/client/alerts';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';

const SEVERITY_LABELS: Record<string, string> = {
  P1: 'P1(紧急)', P2: 'P2(工单)', P3: 'P3(信息)',
};

export function AlertSubscriptions() {
  const { toast } = useToast();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setSubs(await fetchSubscriptions());
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch pattern (see WorkflowList)
    load();
  }, [load]);

  const toggle = (severity: string) => {
    setSubs((prev) => {
      const existing = prev.find((s) => s.severity === severity);
      if (existing) {
        return prev.map((s) => (s.severity === severity ? { ...s, enabled: !s.enabled } : s));
      }
      return [...prev, { severity, teamId: null, enabled: true }];
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const enabled = subs.filter((s) => s.enabled);
      const result = await replaceSubscriptions(enabled);
      setSubs(result);
      toast('订阅已保存', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CardSkeleton count={2} />;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">通知订阅</h3>
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
                onClick={() => toggle(sev)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${on ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-hover)]'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${on ? 'translate-x-4.5' : 'translate-x-1'}`} />
              </button>
            </label>
          );
        })}
      </div>

      <button className="px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium cursor-pointer hover:opacity-90 disabled:opacity-50" disabled={saving} onClick={save}>
        {saving ? '保存中...' : '保存订阅'}
      </button>
    </div>
  );
}