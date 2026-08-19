import { useCallback, useEffect, useState } from 'react';
import { Plus, BellOff, Trash2, Pencil } from 'lucide-react';
import {
  type AlertRule,
  type AlertRuleInput,
  fetchAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  silenceAlertRule,
  METRIC_TYPES,
} from '../../../../api/client/alerts';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';

const OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;
const SEVERITIES = ['P1', 'P2', 'P3'] as const;

const METRIC_LABELS: Record<string, string> = {
  success_rate: '成功率',
  p95_latency: 'P95 延迟(s)',
  avg_latency: '平均延迟(s)',
  daily_cost: '日成本($)',
  error_count: '错误次数',
};

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤',
};

const SEVERITY_LABELS: Record<string, string> = {
  P1: 'P1(紧急)', P2: 'P2(工单)', P3: 'P3(信息)',
};

interface RuleForm {
  name: string;
  metricType: string;
  operator: string;
  threshold: string;
  windowSeconds: string;
  severity: string;
  cooldownSeconds: string;
  runbookUrl: string;
}

const EMPTY_FORM: RuleForm = {
  name: '',
  metricType: 'success_rate',
  operator: 'lt',
  threshold: '95',
  windowSeconds: '3600',
  severity: 'P2',
  cooldownSeconds: '300',
  runbookUrl: '',
};

export function AlertRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlertRule | 'new' | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRules(await fetchAlertRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch pattern (see WorkflowList)
    load();
  }, [load]);

  const toggleEnabled = async (rule: AlertRule) => {
    try {
      await updateAlertRule(rule.id, { enabled: !rule.enabled });
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  const openCreate = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
  };

  const openEdit = (rule: AlertRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      metricType: rule.metricType,
      operator: rule.operator,
      threshold: String(rule.threshold),
      windowSeconds: String(rule.windowSeconds),
      severity: rule.severity,
      cooldownSeconds: String(rule.cooldownSeconds),
      runbookUrl: rule.runbookUrl ?? '',
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      const payload: AlertRuleInput = {
        name: form.name,
        metricType: form.metricType,
        operator: form.operator as AlertRuleInput['operator'],
        threshold: Number(form.threshold),
        windowSeconds: Number(form.windowSeconds),
        severity: form.severity as AlertRuleInput['severity'],
        cooldownSeconds: Number(form.cooldownSeconds),
        runbookUrl: form.runbookUrl || null,
      };
      if (editing && editing !== 'new') {
        await updateAlertRule(editing.id, payload);
      } else {
        await createAlertRule(payload);
      }
      await load();
      setEditing(null);
      toast(editing && editing !== 'new' ? '规则已更新' : '规则已创建', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (rule: AlertRule) => {
    try {
      await deleteAlertRule(rule.id);
      await load();
      toast('规则已删除', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  const silence = async (rule: AlertRule) => {
    const hours = window.prompt(`输入静音时长(小时)，留空取消静音:`, '1');
    if (hours === null) return;
    try {
      if (hours.trim() === '') {
        await silenceAlertRule(rule.id, null);
      } else {
        const ms = Number(hours) * 3600 * 1000;
        await silenceAlertRule(rule.id, new Date(Date.now() + ms).toISOString());
      }
      await load();
      toast(hours.trim() === '' ? '已取消静音' : '已静音', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  if (loading) return <CardSkeleton count={4} />;

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
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">告警规则</h3>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium cursor-pointer hover:opacity-90"
        >
          <Plus size={14} /> 新建规则
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-muted)]">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">条件</th>
              <th className="px-4 py-3 font-medium">窗口</th>
              <th className="px-4 py-3 font-medium">级别</th>
              <th className="px-4 py-3 font-medium">runbook</th>
              <th className="px-4 py-3 font-medium">启用</th>
              <th className="px-4 py-3 font-medium">静音</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)]">
                <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{rule.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {METRIC_LABELS[rule.metricType] ?? rule.metricType} {OPERATOR_LABELS[rule.operator] ?? rule.operator} {rule.threshold}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{rule.windowSeconds}s</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    rule.severity === 'P1'
                      ? 'bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]'
                      : rule.severity === 'P2'
                        ? 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]'
                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]'
                  }`}>
                    {SEVERITY_LABELS[rule.severity] ?? rule.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {rule.runbookUrl ? <a className="text-[var(--color-accent)] hover:underline" href={rule.runbookUrl} target="_blank" rel="noopener noreferrer">链接</a> : '-'}
                </td>
                <td className="px-4 py-3">
                  <button
                    role="switch"
                    aria-checked={rule.enabled}
                    onClick={() => toggleEnabled(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${rule.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-hover)]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">
                  {rule.silenceUntil ? `至 ${new Date(rule.silenceUntil).toLocaleString()}` : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" title="静音" onClick={() => silence(rule)}>
                      <BellOff size={14} />
                    </button>
                    <button className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" title="编辑" onClick={() => openEdit(rule)}>
                      <Pencil size={14} />
                    </button>
                    <button className="p-1.5 rounded-md text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] cursor-pointer" title="删除" onClick={() => remove(rule)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">暂无规则</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">{editing === 'new' ? '新建规则' : '编辑规则'}</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">名称</label>
                <input placeholder="规则名称" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">指标</label>
                  <select className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.metricType} onChange={(e) => setForm({ ...form, metricType: e.target.value })}>
                    {METRIC_TYPES.map((m) => <option key={m} value={m}>{METRIC_LABELS[m] ?? m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">运算符</label>
                  <select className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}>
                    {OPERATORS.map((o) => <option key={o} value={o}>{OPERATOR_LABELS[o] ?? o}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">阈值</label>
                  <input type="number" step="any" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">窗口(秒)</label>
                  <input type="number" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.windowSeconds} onChange={(e) => setForm({ ...form, windowSeconds: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">级别</label>
                  <select className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                    {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s] ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-text-muted)]">冷却(秒)</label>
                  <input type="number" className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.cooldownSeconds} onChange={(e) => setForm({ ...form, cooldownSeconds: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">runbook URL</label>
                <input className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]" value={form.runbookUrl} onChange={(e) => setForm({ ...form, runbookUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-4 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" onClick={() => setEditing(null)}>取消</button>
              <button className="px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-50" disabled={saving || !form.name} onClick={submit}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}