import { useState } from 'react';
import type { BudgetStatus } from '../../../../../../api/client/cost';
import { type BudgetInput, useBudget } from '../hooks/useBudget';
import { BUDGET_WARNING_THRESHOLD, getBudgetAlert, isBudgetConfigured } from '../utils/costUtils';
import { formatCost } from '../../shared/format';

interface BudgetPanelProps {
  onError?: (message: string) => void;
  onSaved?: () => void;
}

const MAX_LIMIT = 100_000_000; // 防止误输入天文数字

/**
 * 预算面板：进度展示 + 限额编辑。
 *
 * 此前后端已提供 GET/PUT /cost/budget，前端却只有告警横幅没有设置入口，
 * 用户无法在系统内调整限额。
 */
export function BudgetPanel({ onError, onSaved }: BudgetPanelProps) {
  const { budget, isLoading, isSaving, save } = useBudget();
  const [editing, setEditing] = useState(false);
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');

  const alert = getBudgetAlert(budget);
  const configured = isBudgetConfigured(budget);

  const startEditing = () => {
    setDaily(budget?.daily_limit ? String(budget.daily_limit) : '');
    setMonthly(budget?.monthly_limit ? String(budget.monthly_limit) : '');
    setEditing(true);
  };

  const submit = async () => {
    const dailyVal = Number(daily);
    const monthlyVal = Number(monthly);

    // 客户端防御：负数、非法输入、超上限直接拦截，避免把脏数据发到服务端。
    if (
      (daily !== '' && (Number.isNaN(dailyVal) || dailyVal < 0 || dailyVal > MAX_LIMIT)) ||
      (monthly !== '' && (Number.isNaN(monthlyVal) || monthlyVal < 0 || monthlyVal > MAX_LIMIT))
    ) {
      onError?.('限额必须是 0 ~ 100,000,000 之间的数字');
      return;
    }

    const input: BudgetInput = {
      dailyLimit: Number.isNaN(dailyVal) ? 0 : dailyVal,
      monthlyLimit: Number.isNaN(monthlyVal) ? 0 : monthlyVal,
    };
    try {
      await save(input);
      setEditing(false);
      onSaved?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : '保存预算失败');
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6 shadow-sm">
        <div className="h-5 w-24 rounded bg-[var(--color-surface-hover)] animate-pulse" />
        <div className="mt-4 h-16 rounded bg-[var(--color-surface-hover)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">预算</h3>
        {/* 未配置时用下方的引导态 CTA（更显眼）；已配置时这里给一个低权重“编辑”入口 */}
        {!editing && configured && (
          <button
            onClick={startEditing}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            编辑限额
          </button>
        )}
      </div>

      {alert && (
        <div
          className={`mt-4 rounded-lg border p-3 ${
            alert.type === 'danger'
              ? 'border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)]'
              : 'border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)]'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              alert.type === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'
            }`}
          >
            {alert.msg}
          </p>
        </div>
      )}

      {editing ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">日限额（USD / 天，0 = 不限）</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              className="w-36 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--color-text-muted)]">月限额（USD / 自然月，0 = 不限）</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="w-36 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </label>
          <button
            onClick={submit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {isSaving ? '保存中…' : '保存'}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            取消
          </button>
        </div>
      ) : !configured ? (
        <BudgetEmptyState onSetup={startEditing} spend={budget ? budget.monthly_spend : 0} />
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BudgetBar label="今日（UTC 日窗）" budget={budget} kind="daily" />
          <BudgetBar label="本月（自然月）" budget={budget} kind="monthly" />
        </div>
      )}
    </div>
  );
}

interface BudgetBarProps {
  label: string;
  budget: BudgetStatus | null;
  kind: 'daily' | 'monthly';
}

function BudgetBar({ label, budget, kind }: BudgetBarProps) {
  const limit = kind === 'daily' ? (budget?.daily_limit ?? 0) : (budget?.monthly_limit ?? 0);
  const spend = kind === 'daily' ? (budget?.daily_spend ?? 0) : (budget?.monthly_spend ?? 0);
  const percent = kind === 'daily' ? (budget?.daily_percent ?? 0) : (budget?.monthly_percent ?? 0);

  const exceeded = spend > limit;
  const nearLimit = !exceeded && percent >= BUDGET_WARNING_THRESHOLD;
  const barColor = exceeded
    ? 'var(--color-danger)'
    : nearLimit
      ? 'var(--color-warning)'
      : 'var(--color-success)';
  // 用 cost 列同级精度显示，避免“支出 0.0040 / 限额 1.00”这种位数错乱。
  const barWidth = spend <= 0 ? 0 : Math.min(100, Math.max(percent, 2));

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{label}</span>
        <span className="tabular-nums">
          {formatCost(spend)} / {formatCost(limit)}
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface-elevated)' }}
        role="progressbar"
        aria-valuenow={Math.min(100, percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}预算使用 ${percent}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>
      <p
        className="mt-1.5 text-xs tabular-nums"
        style={{ color: exceeded ? 'var(--color-danger)' : 'var(--color-text-muted)' }}
      >
        {exceeded ? `已超 ${formatCost(spend - limit)}` : `${percent}%`}
      </p>
    </div>
  );
}

interface BudgetEmptyStateProps {
  onSetup: () => void;
  /** 本月累计支出，用于未设置前让用户先看到量级 */
  spend: number;
}

/** 未设置任何限额时的引导态：不再用两列近乎空白的 “未设置限额” 占位。 */
function BudgetEmptyState({ onSetup, spend }: BudgetEmptyStateProps) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] p-4">
      <div className="flex items-center gap-3">
        <svg
          className="w-5 h-5 shrink-0 text-[var(--color-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm text-[var(--color-text-primary)]">
            设置日 / 月限额，超出即触发告警
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            本月累计支出 {formatCost(spend)}
          </p>
        </div>
        <button
          onClick={onSetup}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
        >
          立即设置
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
