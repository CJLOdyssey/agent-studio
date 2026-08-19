import type { CostSummary } from '../../../../api/client/cost';

interface AgentMetricsProps {
  summary: CostSummary | null;
}

export function AgentMetrics({ summary }: AgentMetricsProps) {
  if (!summary) {
    return null;
  }

  const nodes = Object.entries(summary.by_node).sort((a, b) => b[1].tokens - a[1].tokens);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
      <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Agent 性能指标（最近 7 天）</h3>
      <div className="space-y-3">
        {nodes.map(([nodeId, data]) => (
          <div key={nodeId} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{nodeId}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{data.calls} 次调用</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-[var(--color-text-muted)]">Token 消耗</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {data.tokens.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)]">成本</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  ${data.cost_usd.toFixed(4)}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)]">平均 Token/次</div>
                <div className="font-medium text-[var(--color-text-primary)]">
                  {data.calls > 0 ? Math.round(data.tokens / data.calls).toLocaleString() : 0}
                </div>
              </div>
            </div>
          </div>
        ))}
        {nodes.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)]">暂无数据</p>
        )}
      </div>
    </div>
  );
}
