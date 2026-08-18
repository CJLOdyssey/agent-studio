import { useState, useEffect } from 'react';
import { fetchCostSummary, type CostSummary } from '../../../../api/client/cost';
import { CardSkeleton } from '../shared/LoadingSkeleton';

interface TokenUsageProps {
  teamId?: string;
}

export function TokenUsage({ teamId }: TokenUsageProps) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchCostSummary(teamId, 7);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId]);

  if (loading) {
    return <CardSkeleton count={2} />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const models = Object.entries(summary.by_model).sort((a, b) => b[1].tokens - a[1].tokens);
  const maxTokens = Math.max(...models.map(([, data]) => data.tokens), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">Token 消耗分布（最近 7 天）</h3>
        <div className="space-y-3">
          {models.map(([model, data]) => {
            const percentage = (data.tokens / maxTokens) * 100;
            return (
              <div key={model}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-900">{model}</span>
                  <span className="text-gray-500">
                    {data.tokens.toLocaleString()} tokens · ${data.cost_usd.toFixed(4)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {data.calls} 次调用 · 平均 {data.calls > 0 ? Math.round(data.tokens / data.calls).toLocaleString() : 0} tokens/次
                </div>
              </div>
            );
          })}
          {models.length === 0 && (
            <p className="text-center text-sm text-gray-500">暂无数据</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">总体统计</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">总 Token</div>
            <div className="text-lg font-semibold text-gray-900">
              {summary.total_tokens.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">总成本</div>
            <div className="text-lg font-semibold text-gray-900">
              ${summary.total_cost_usd.toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Prompt Tokens</div>
            <div className="text-sm font-medium text-gray-700">
              {summary.total_prompt_tokens.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Completion Tokens</div>
            <div className="text-sm font-medium text-gray-700">
              {summary.total_completion_tokens.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
