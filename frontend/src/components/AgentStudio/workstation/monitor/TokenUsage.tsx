import type { CostSummary } from '../../../../api/client/cost';

interface TokenUsageProps {
  summary: CostSummary | null;
}

export function TokenUsage({ summary }: TokenUsageProps) {
  if (!summary) {
    return null;
  }

  const models = Object.entries(summary.by_model).sort((a, b) => b[1].tokens - a[1].tokens);
  const maxTokens = Math.max(...models.map(([, data]) => data.tokens), 1);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Token 消耗分布（最近 7 天）</h3>
      <div className="space-y-3">
        {models.map(([model, data]) => {
          const percentage = (data.tokens / maxTokens) * 100;
          return (
            <div key={model}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--color-text-primary)]">{model}</span>
                <span className="text-[var(--color-text-muted)]">
                  {data.tokens.toLocaleString()} tokens · ${data.cost_usd.toFixed(4)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                {data.calls} 次调用 · 平均 {data.calls > 0 ? Math.round(data.tokens / data.calls).toLocaleString() : 0} tokens/次
              </div>
            </div>
          );
        })}
        {models.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)]">暂无数据</p>
        )}
      </div>
    </div>
  );
}
