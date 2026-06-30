export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="wsta-skeleton-wrap" role="status" aria-label="加载中">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="wsta-skeleton-row" style={{ '--sk-delay': `${r * 0.05}s` } as React.CSSProperties}>
          <div className="wsta-skeleton-checkbox" />
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="wsta-skeleton-cell" style={{ width: `${60 + Math.random() * 30}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="wsta-skeleton-card-grid" role="status" aria-label="加载中">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="wsta-skeleton-card" style={{ '--sk-delay': `${i * 0.05}s` } as React.CSSProperties}>
          <div className="wsta-skeleton-card-icon" />
          <div className="wsta-skeleton-card-body">
            <div className="wsta-skeleton-text wsta-skeleton-text-short" />
            <div className="wsta-skeleton-text wsta-skeleton-text-long" />
          </div>
        </div>
      ))}
    </div>
  );
}
