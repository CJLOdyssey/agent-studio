interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** 整页级错误：给出明确原因与重试入口，取代此前的静默空白。 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--color-danger)]">{message}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            请检查网络或服务状态后重试。
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-lg hover:opacity-90 transition-opacity"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}

interface PartialErrorBannerProps {
  /** 失败的数据源名称，例如「成本趋势」 */
  sources: string[];
  onRetry?: () => void;
}

/** 局部降级提示：部分接口失败时，其余区块仍正常展示。 */
export function PartialErrorBanner({ sources, onRetry }: PartialErrorBannerProps) {
  if (sources.length === 0) return null;

  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-[var(--color-warning)]">
          {sources.join('、')} 加载失败，其余数据不受影响
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            重新加载
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = '暂无成本数据',
  description = '开始对话后将自动生成成本分析',
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-12 shadow-sm">
      <div className="flex flex-col items-center justify-center">
        <svg
          className="w-16 h-16 text-[var(--color-text-muted)] opacity-40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <p className="mt-3 text-base font-medium text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
      </div>
    </div>
  );
}
