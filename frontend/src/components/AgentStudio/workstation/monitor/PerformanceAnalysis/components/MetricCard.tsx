interface MetricCardProps {
  /** 指标标签 */
  label: string;
  /** 指标值（已格式化） */
  value: string;
  /** 子信息（如分位数、目标值） */
  sub?: string;
  /** 是否为空状态 */
  isEmpty?: boolean;
}

/**
 * 指标卡片组件（大厂风格：简约）
 *
 * 仅展示：标签 + 数值 + 子信息
 */
export function MetricCard({ label, value, sub, isEmpty = false }: MetricCardProps) {
  if (isEmpty) {
    return (
      <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4 opacity-50">
        <div className="text-xs font-medium text-[var(--color-text-muted)]">{label}</div>
        <div className="mt-2 text-3xl font-bold text-[var(--color-text-muted)]">--</div>
        <div className="mt-1 text-xs text-[var(--color-text-muted)]">暂无数据</div>
      </article>
    );
  }

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
      <div className="text-xs font-medium text-[var(--color-text-muted)]">{label}</div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-[var(--color-text-primary)]">{value}</div>
      {sub && <div className="mt-1 text-xs text-[var(--color-text-muted)]">{sub}</div>}
    </article>
  );
}
