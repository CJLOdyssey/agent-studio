export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="p-4 animate-[wsta-skeleton-fade_0.3s_ease-in]" role="status" aria-label="加载中">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 py-3 px-4 border-b border-[var(--color-border)] animate-[wsta-skeleton-pulse_1.5s_ease-in_out_infinite]" style={{ '--sk-delay': `${r * 0.05}s` } as React.CSSProperties}>
          <div className="w-4 h-4 rounded-[3px] bg-[var(--color-surface-hover)] shrink-0" />
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="h-3.5 rounded bg-[var(--color-surface-hover)] flex-1" style={{ width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-5 px-6 animate-[wsta-skeleton-fade_0.3s_ease-in]" role="status" aria-label="加载中">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border border-[var(--color-border)] rounded-[10px] animate-[wsta-skeleton-pulse_1.5s_ease-in_out_infinite]" style={{ '--sk-delay': `${i * 0.05}s` } as React.CSSProperties}>
          <div className="w-11 h-11 rounded-[10px] bg-[var(--color-surface-hover)] shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 rounded bg-[var(--color-surface-hover)] w-2/5" />
            <div className="h-3 rounded bg-[var(--color-surface-hover)] w-[70%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
