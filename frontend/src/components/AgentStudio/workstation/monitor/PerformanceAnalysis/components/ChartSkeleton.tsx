interface ChartSkeletonProps {
  height?: number;
}

export function ChartSkeleton({ height = 450 }: ChartSkeletonProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg bg-[var(--color-surface-hover)] animate-[wsta-skeleton-pulse_1.5s_ease-in-out_infinite]"
      style={{ height }}
      role="status"
      aria-label="图表加载中"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[var(--color-text-muted)]">加载中...</span>
        </div>
      </div>
      {/* 骨架网格线 */}
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
          <line
            key={ratio}
            x1="60"
            y1={`${ratio * 100}%`}
            x2="100%"
            y2={`${ratio * 100}%`}
            stroke="var(--color-border)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        ))}
      </svg>
    </div>
  );
}
