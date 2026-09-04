import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  type SloDefinition,
  fetchSloDefinitions,
  createSloDefinition,
  updateSloDefinition,
  deleteSloDefinition,
  fetchSloBudget,
} from '../../../../api/client/slo';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';

const METRIC_LABELS: Record<string, string> = {
  success_rate: '成功率',
  p95_latency: 'P95 延迟',
  avg_latency: '平均延迟',
};

const DEFINITIONS_KEY = ['slo-definitions'] as const;

export function SloBudget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [metricType, setMetricType] = useState('success_rate');
  const [target, setTarget] = useState('99');
  const [windowDays, setWindowDays] = useState('30');
  const [deleting, setDeleting] = useState<SloDefinition | null>(null);

  const { data: definitions = [], isPending: defsPending } = useQuery({
    queryKey: DEFINITIONS_KEY,
    queryFn: fetchSloDefinitions,
  });

  // 预算卡跟随定义的真实窗口(此前硬编码 30 天，改定义窗口不生效)。无定义时用表单值兜底。
  const budgetTarget = definitions.length > 0 ? definitions[0].targetPercent : Number(target) || 99;
  const budgetWindow = (definitions.length > 0 ? definitions[0].windowDays || 30 : Number(windowDays) || 30) * 86400;

  const { data: budget } = useQuery({
    queryKey: ['slo-budget', budgetTarget, budgetWindow],
    queryFn: () => fetchSloBudget(budgetTarget, budgetWindow),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: DEFINITIONS_KEY });
    queryClient.invalidateQueries({ queryKey: ['slo-budget'] });
  };

  const createMutation = useMutation({
    mutationFn: (input: Parameters<typeof createSloDefinition>[0]) => createSloDefinition(input),
    onSuccess: () => {
      setName('');
      invalidate();
      toast('SLO 已创建', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '创建失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (sliId: string) => deleteSloDefinition(sliId),
    onSuccess: () => {
      invalidate();
      toast('SLO 已删除', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (def: SloDefinition) => updateSloDefinition(def.id, { enabled: !def.enabled }),
    onSuccess: () => invalidate(),
    onError: (err) => toast(err instanceof Error ? err.message : '操作失败', 'error'),
  });

  const submit = () => {
    createMutation.mutate({
      name,
      metricType,
      targetPercent: Number(target),
      windowDays: Number(windowDays),
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, { onSettled: () => setDeleting(null) });
  };

  const toggle = (def: SloDefinition) => toggleMutation.mutate(def);

  if (defsPending) return <CardSkeleton count={3} />;

  // 后端 budgetRemainingPercent 已是 0~100 的"剩余占配额%"(error=0 → 100)。去掉旧的
  // 再除 (100-target) 的换算(历史单位错，导致 100% 显示成 1.00% 且与 bar 打架)。
  const budgetPct = budget ? Math.max(0, Math.min(100, budget.budgetRemainingPercent)) : 0;
  const budgetBarWidth = budgetPct;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">SLO 错误预算</h3>
      </div>

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
        <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[10px] text-[var(--color-text-muted)]">名称</span>
            <input placeholder="如：请求成功率" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-[var(--color-text-muted)]">指标</span>
            <select value={metricType} onChange={(e) => setMetricType(e.target.value)} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
              {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-[var(--color-text-muted)]">目标成功率 (%)</span>
            <input placeholder="如 99" value={target} onChange={(e) => setTarget(e.target.value)} type="number" min="0" max="100" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] text-[var(--color-text-muted)]">窗口（天）</span>
            <input placeholder="如 30" value={windowDays} onChange={(e) => setWindowDays(e.target.value)} type="number" min="1" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]" />
          </label>
        </div>
        <p className="mb-2 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
          含义：在「窗口」天数内，该项指标成功率 ≥「目标成功率」（如 99 表示 99%）。监控服务启用后会按周期自动校验，跌破时产生告警事件。
        </p>
        <button onClick={submit} disabled={!name || !target} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white cursor-pointer hover:opacity-90 disabled:opacity-50">
          <Plus size={13} /> 添加 SLO
        </button>

        <div className="mt-4 space-y-2">
          {definitions.map((def) => (
            <div key={def.id} className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <div className="flex items-center gap-3">
                <button role="switch" aria-checked={def.enabled} onClick={() => toggle(def)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${def.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-hover)]'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${def.enabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                </button>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">{def.name}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">{METRIC_LABELS[def.metricType] ?? def.metricType} · 目标 {def.targetPercent}% · {def.windowDays} 天</div>
                </div>
              </div>
              <button className="p-1.5 rounded-md text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] cursor-pointer" title="删除" onClick={() => setDeleting(def)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {definitions.length === 0 && <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">暂无 SLO 定义</p>}
        </div>
      </div>

      {deleting && (
        <DeleteConfirmModal
          name={deleting.name}
          label="SLO"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
