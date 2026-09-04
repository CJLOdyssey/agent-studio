interface MetricCardProps {
  label: string;
  value: string;
  color: string;
  sub?: string;
  footer?: string;
}

export function MetricCard({ label, value, color, sub, footer }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        <span
          aria-hidden="true"
          className="inline-block shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-4 text-3xl font-bold text-[var(--color-text-primary)] tabular-nums leading-tight truncate">
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-sm text-[var(--color-text-secondary)] tabular-nums">{sub}</div>
      )}
      {footer && (
        <div className="mt-1 text-xs text-[var(--color-text-muted)] tabular-nums">{footer}</div>
      )}
    </div>
  );
}