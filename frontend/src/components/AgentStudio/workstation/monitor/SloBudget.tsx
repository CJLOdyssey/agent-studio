import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  type SloDefinition,
  type SloBudgetSnapshot,
  fetchSloDefinitions,
  createSloDefinition,
  updateSloDefinition,
  deleteSloDefinition,
  fetchSloBudget,
} from '../../../../api/client/slo';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';

const METRIC_LABELS: Record<string, string> = {
  success_rate: '成功率',
  p95_latency: 'P95 延迟',
  avg_latency: '平均延迟',
};

export function SloBudget() {
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<SloDefinition[]>([]);
  const [budget, setBudget] = useState<SloBudgetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [metricType, setMetricType] = useState('success_rate');
  const [target, setTarget] = useState('99');
  const [windowDays, setWindowDays] = useState('30');

  const loadBudget = useCallback(async (targetPct: number) => {
    try {
      setBudget(await fetchSloBudget(targetPct, 30 * 86400));
    } catch {
      setBudget(null);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const defs = await fetchSloDefinitions();
      setDefinitions(defs);
      if (defs.length > 0) {
        await loadBudget(defs[0].targetPercent);
      } else {
        await loadBudget(Number(target) || 99);
      }
    } catch {
      /* 空态处理 */
    } finally {
      setLoading(false);
    }
  }, [loadBudget, target]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch pattern
    load();
  }, [load]);

  const submit = async () => {
    try {
      await createSloDefinition({
        name,
        metricType,
        targetPercent: Number(target),
        windowDays: Number(windowDays),
      });
      setName('');
      await load();
      toast('SLO 已创建', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '创建失败', 'error');
    }
  };

  const remove = async (def: SloDefinition) => {
    try {
      await deleteSloDefinition(def.id);
      await load();
      toast('SLO 已删除', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  const toggle = async (def: SloDefinition) => {
    try {
      await updateSloDefinition(def.id, { enabled: !def.enabled });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  if (loading) return <CardSkeleton count={3} />;

  const budgetPct = budget ? (budget.budgetRemainingPercent / (100 - budget.targetPercent)) * 100 : 0;
  const budgetBarWidth = Math.max(0, Math.min(100, budgetPct));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">SLO 错误预算</h3>

      {budget && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>目标 {budget.targetPercent}% · 最近 {(budget.windowSeconds / 86400).toFixed(0)} 天</span>
            <span>请求 {budget.totalRequests} · 错误 {budget.errorCount}</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">{budget.sliPercent}%</div>
              <div className="text-xs text-[var(--color-text-muted)]">当前 SLI</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[var(--color-warning)]">{budget.burnRate}</div>
              <div className="text-xs text-[var(--color-text-muted)]">burn rate</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-[var(--color-text-muted)]">
              <span>预算剩余 {budget.budgetRemainingPercent.toFixed(2)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
              <div className={`h-full rounded-full ${budgetPct > 50 ? 'bg-[var(--color-success)]' : budgetPct > 20 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-danger)]'}`} style={{ width: `${budgetBarWidth}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
        <h4 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">SLO 定义</h4>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]" />
          <select value={metricType} onChange={(e) => setMetricType(e.target.value)} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
            {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input placeholder="目标 %" value={target} onChange={(e) => setTarget(e.target.value)} type="number" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]" />
          <input placeholder="窗口天数" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} type="number" className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]" />
        </div>
        <button onClick={submit} disabled={!name || !target} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white cursor-pointer hover:opacity-90 disabled:opacity-50">
          <Plus size={13} /> 添加 SLO
        </button>

        <div className="mt-4 space-y-2">
          {definitions.map((def) => (
            <div key={def.id} className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <div className="flex items-center gap-3">
                <button role="switch" aria-checked={def.enabled} onClick={() => toggle(def)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${def.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-hover)]'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${def.enabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{def.name}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{METRIC_LABELS[def.metricType] ?? def.metricType} · 目标 {def.targetPercent}% · {def.windowDays} 天</div>
                </div>
              </div>
              <button className="p-1.5 rounded-md text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] cursor-pointer" title="删除" onClick={() => remove(def)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {definitions.length === 0 && <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">暂无 SLO 定义</p>}
        </div>
      </div>
    </div>
  );
}