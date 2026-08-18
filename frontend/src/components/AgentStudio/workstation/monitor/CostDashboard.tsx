import { useState, useEffect } from 'react';
import { fetchCostSummary, fetchModelPricing, type CostSummary, type ModelPricing } from '../../../../api/client/cost';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { AgentMetrics } from './AgentMetrics';
import { TokenUsage } from './TokenUsage';

interface CostDashboardProps {
  teamId?: string;
}

export function CostDashboard({ teamId }: CostDashboardProps) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, pricingData] = await Promise.all([
          fetchCostSummary(teamId, period),
          fetchModelPricing(),
        ]);
        setSummary(summaryData);
        setPricing(pricingData);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId, period]);

  if (loading) {
    return <CardSkeleton count={4} />;
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

  const avgCostPerCall = summary.total_calls > 0 ? summary.total_cost_usd / summary.total_calls : 0;
  const avgTokensPerCall = summary.total_calls > 0 ? summary.total_tokens / summary.total_calls : 0;

  return (
    <div className="space-y-6">
      {/* 时间周期选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">成本仪表盘</h2>
        <div className="flex gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === days
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {days}天
            </button>
          ))}
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">总成本</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            ${summary.total_cost_usd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            最近 {period} 天
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">总调用次数</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {summary.total_calls.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            平均 ${avgCostPerCall.toFixed(4)}/次
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">总 Token 消耗</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {(summary.total_tokens / 1000).toFixed(1)}K
          </div>
          <div className="mt-1 text-xs text-gray-500">
            平均 {Math.round(avgTokensPerCall).toLocaleString()} tokens/次
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500">活跃模型数</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {Object.keys(summary.by_model).length}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {Object.keys(summary.by_node).length} 个 Agent
          </div>
        </div>
      </div>

      {/* 详细分析 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TokenUsage teamId={teamId} />
        <AgentMetrics teamId={teamId} />
      </div>

      {/* 模型定价参考 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">模型定价参考</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  模型
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Prompt 价格 (每1K tokens)
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Completion 价格 (每1K tokens)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pricing.map((model) => (
                <tr key={model.model}>
                  <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-gray-900">
                    {model.model}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-700">
                    ${model.prompt_cost_per_1k.toFixed(4)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-700">
                    ${model.completion_cost_per_1k.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
