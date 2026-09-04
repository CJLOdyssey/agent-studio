import { type AlertRule, METRIC_TYPES } from '../../../../api/client/alerts';
import Modal from '../../../../components/shared/Modal';
import { SEVERITY_LABELS, METRIC_LABELS, OPERATOR_LABELS, INPUT_CLASS } from './constants';

const OPERATORS = ['gt', 'gte', 'lt', 'lte'] as const;
const SEVERITIES = ['P1', 'P2', 'P3'] as const;

export interface RuleForm {
  name: string;
  metricType: string;
  operator: string;
  threshold: string;
  windowSeconds: string;
  severity: string;
  cooldownSeconds: string;
  runbookUrl: string;
}

export interface FormErrors {
  name?: string;
  threshold?: string;
  windowSeconds?: string;
  cooldownSeconds?: string;
  runbookUrl?: string;
}

export const EMPTY_FORM: RuleForm = {
  name: '',
  metricType: 'success_rate',
  operator: 'lt',
  threshold: '95',
  windowSeconds: '3600',
  severity: 'P2',
  cooldownSeconds: '300',
  runbookUrl: '',
};

export function validateForm(form: RuleForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = '名称不能为空';
  const threshold = Number(form.threshold);
  if (Number.isNaN(threshold) || threshold <= 0) errors.threshold = '阈值必须大于 0';
  const windowSeconds = Number(form.windowSeconds);
  if (Number.isNaN(windowSeconds) || windowSeconds <= 0) errors.windowSeconds = '窗口必须大于 0';
  const cooldownSeconds = Number(form.cooldownSeconds);
  if (Number.isNaN(cooldownSeconds) || cooldownSeconds < 0) errors.cooldownSeconds = '冷却不能为负数';
  if (form.runbookUrl && !/^https?:\/\/.+/i.test(form.runbookUrl)) errors.runbookUrl = 'URL 格式无效';
  return errors;
}

interface RuleFormModalProps {
  rule: AlertRule | 'new';
  form: RuleForm;
  errors: FormErrors;
  saving: boolean;
  onClose: () => void;
  onChange: (form: RuleForm) => void;
  onSubmit: () => void;
}

export function RuleFormModal({ rule, form, errors, saving, onClose, onChange, onSubmit }: RuleFormModalProps) {
  return (
    <Modal
      title={rule === 'new' ? '新建规则' : '编辑规则'}
      onClose={onClose}
      footer={
        <>
          <button className="px-4 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" onClick={onClose}>取消</button>
          <button className="px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-50" disabled={saving} onClick={onSubmit}>
            {saving ? '保存中...' : '保存'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">名称</label>
          <input placeholder="规则名称" className={INPUT_CLASS} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">指标</label>
            <select className={INPUT_CLASS} value={form.metricType} onChange={(e) => onChange({ ...form, metricType: e.target.value })}>
              {METRIC_TYPES.map((m) => <option key={m} value={m}>{METRIC_LABELS[m] ?? m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">运算符</label>
            <select className={INPUT_CLASS} value={form.operator} onChange={(e) => onChange({ ...form, operator: e.target.value })}>
              {OPERATORS.map((o) => <option key={o} value={o}>{OPERATOR_LABELS[o] ?? o}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">阈值</label>
            <input type="number" step="any" min="0.01" className={INPUT_CLASS} value={form.threshold} onChange={(e) => onChange({ ...form, threshold: e.target.value })} />
            {errors.threshold && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.threshold}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">窗口(秒)</label>
            <input type="number" min="1" className={INPUT_CLASS} value={form.windowSeconds} onChange={(e) => onChange({ ...form, windowSeconds: e.target.value })} />
            {errors.windowSeconds && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.windowSeconds}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">级别</label>
            <select className={INPUT_CLASS} value={form.severity} onChange={(e) => onChange({ ...form, severity: e.target.value })}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s] ?? s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-muted)]">冷却(秒)</label>
            <input type="number" min="0" className={INPUT_CLASS} value={form.cooldownSeconds} onChange={(e) => onChange({ ...form, cooldownSeconds: e.target.value })} />
            {errors.cooldownSeconds && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.cooldownSeconds}</p>}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">runbook URL</label>
          <input type="url" className={INPUT_CLASS} value={form.runbookUrl} onChange={(e) => onChange({ ...form, runbookUrl: e.target.value })} placeholder="https://..." />
          {errors.runbookUrl && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.runbookUrl}</p>}
        </div>
      </div>
    </Modal>
  );
}
