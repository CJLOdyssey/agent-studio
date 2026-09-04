import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, BellOff, Trash2, Pencil } from 'lucide-react';
import {
  type AlertRule,
  type AlertRuleInput,
  fetchAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
  silenceAlertRule,
} from '../../../../api/client/alerts';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { useToast } from '../../../../utils/useToast';
import DeleteConfirmModal from '../shared/DeleteConfirmModal';
import { SEVERITY_LABELS, METRIC_LABELS, OPERATOR_LABELS, formatWindow } from './constants';
import { RuleFormModal, EMPTY_FORM, validateForm, type RuleForm, type FormErrors } from './RuleFormModal';
import { SilenceModal } from './SilenceModal';

const SEVERITY_BADGE: Record<string, string> = {
  P1: 'bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)]',
  P2: 'bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]',
  P3: 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
};

const RULES_KEY = ['alert-rules'] as const;

export function AlertRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AlertRule | 'new' | null>(null);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [deleting, setDeleting] = useState<AlertRule | null>(null);
  const [silencing, setSilencing] = useState<AlertRule | null>(null);
  const [silenceHours, setSilenceHours] = useState('1');
  const [silenceError, setSilenceError] = useState('');

  const { data: rules = [], isPending, isError, error, refetch } = useQuery({
    queryKey: RULES_KEY,
    queryFn: () => fetchAlertRules(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: RULES_KEY });

  const toggleMutation = useMutation({
    mutationFn: (rule: AlertRule) => updateAlertRule(rule.id, { enabled: !rule.enabled }),
    onMutate: async (rule) => {
      await queryClient.cancelQueries({ queryKey: RULES_KEY });
      const previous = queryClient.getQueryData<AlertRule[]>(RULES_KEY);
      queryClient.setQueryData<AlertRule[]>(RULES_KEY, (prev = []) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
      );
      return { previous };
    },
    onError: (_err, _rule, context) => {
      if (context?.previous) queryClient.setQueryData(RULES_KEY, context.previous);
      toast('操作失败', 'error');
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: AlertRuleInput) => createAlertRule(input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast('规则已创建', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const editMutation = useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: AlertRuleInput }) => updateAlertRule(ruleId, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast('规则已更新', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (ruleId: string) => deleteAlertRule(ruleId),
    onSuccess: () => {
      invalidate();
      toast('规则已删除', 'success');
    },
    onError: (err) => toast(err instanceof Error ? err.message : '删除失败', 'error'),
  });

  const silenceMutation = useMutation({
    mutationFn: ({ ruleId, silenceUntil }: { ruleId: string; silenceUntil: string | null }) =>
      silenceAlertRule(ruleId, silenceUntil),
    onSuccess: () => {
      invalidate();
      setSilencing(null);
    },
    onError: (err) => toast(err instanceof Error ? err.message : '操作失败', 'error'),
  });

  const saving = createMutation.isPending || editMutation.isPending;

  const toggleEnabled = (rule: AlertRule) => toggleMutation.mutate(rule);

  const isToggling = (rule: AlertRule) =>
    toggleMutation.isPending && toggleMutation.variables?.id === rule.id;

  const openCreate = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
    setFormErrors({});
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
    setFormErrors({});
  };

  const submit = () => {
    const errors = validateForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: AlertRuleInput = {
      name: form.name.trim(),
      metricType: form.metricType,
      operator: form.operator as AlertRuleInput['operator'],
      threshold: Number(form.threshold),
      windowSeconds: Number(form.windowSeconds),
      severity: form.severity as AlertRuleInput['severity'],
      cooldownSeconds: Number(form.cooldownSeconds),
      runbookUrl: form.runbookUrl || null,
    };
    if (editing && editing !== 'new') {
      editMutation.mutate({ ruleId: editing.id, input: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, { onSettled: () => setDeleting(null) });
  };

  const openSilence = (rule: AlertRule) => {
    setSilencing(rule);
    setSilenceHours('1');
    setSilenceError('');
  };

  const confirmSilence = () => {
    if (!silencing) return;
    const hours = Number(silenceHours);
    if (Number.isNaN(hours) || hours <= 0) {
      setSilenceError('时长必须大于 0');
      return;
    }
    const ms = hours * 3600 * 1000;
    silenceMutation.mutate({
      ruleId: silencing.id,
      silenceUntil: new Date(Date.now() + ms).toISOString(),
    }, { onSuccess: () => toast('已静音', 'success') });
  };

  const cancelSilence = (rule: AlertRule) => {
    silenceMutation.mutate(
      { ruleId: rule.id, silenceUntil: null },
      { onSuccess: () => toast('已取消静音', 'success') },
    );
  };

  if (isPending) return <CardSkeleton count={4} />;

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
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatWindow(rule.windowSeconds)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_BADGE[rule.severity] ?? ''}`}>
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
                    aria-label={rule.enabled ? '禁用规则' : '启用规则'}
                    disabled={isToggling(rule)}
                    onClick={() => toggleEnabled(rule)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${rule.enabled ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface-hover)]'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-[var(--color-text-muted)]">
                  {rule.silenceUntil ? (
                    <span className="inline-flex items-center gap-1">
                      至 {new Date(rule.silenceUntil).toLocaleString()}
                      <button className="p-0.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] cursor-pointer" title="取消静音" onClick={() => cancelSilence(rule)}>
                        <BellOff size={12} />
                      </button>
                    </span>
                  ) : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" title="静音" onClick={() => openSilence(rule)}>
                      <BellOff size={14} />
                    </button>
                    <button className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" title="编辑" onClick={() => openEdit(rule)}>
                      <Pencil size={14} />
                    </button>
                    <button className="p-1.5 rounded-md text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] cursor-pointer" title="删除" onClick={() => setDeleting(rule)}>
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
        <RuleFormModal
          rule={editing}
          form={form}
          errors={formErrors}
          saving={saving}
          onClose={() => setEditing(null)}
          onChange={setForm}
          onSubmit={submit}
        />
      )}

      {deleting && (
        <DeleteConfirmModal
          name={deleting.name}
          label="告警规则"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}

      {silencing && (
        <SilenceModal
          name={silencing.name}
          hours={silenceHours}
          error={silenceError}
          onClose={() => setSilencing(null)}
          onHoursChange={(value) => { setSilenceHours(value); setSilenceError(''); }}
          onConfirm={confirmSilence}
        />
      )}
    </div>
  );
}
