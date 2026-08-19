import { useState, useEffect } from 'react';
import {
  fetchCostSummary,
  fetchModelPricing,
  fetchDailyTrend,
  fetchCostAttribution,
  type CostSummary,
  type ModelPricing,
  type DailyTrendItem,
  type CostAttribution,
} from '../../../../api/client/cost';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { AgentMetrics } from './AgentMetrics';
import { TokenUsage } from './TokenUsage';

interface CostDashboardProps {
  teamId?: string;
}

export function CostDashboard({ teamId }: CostDashboardProps) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [attribution, setAttribution] = useState<CostAttribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, pricingData, trendData, attributionData] = await Promise.all([
          fetchCostSummary(teamId, period),
          fetchModelPricing(),
          fetchDailyTrend(teamId, period),
          fetchCostAttribution(teamId, period),
        ]);
        setSummary(summaryData);
        setPricing(pricingData);
        setDailyTrend(trendData);
        setAttribution(attributionData);
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

      {/* 成本趋势图 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">成本趋势</h3>
        <div className="space-y-2">
          {dailyTrend.map((item, idx) => {
            const maxCost = Math.max(...dailyTrend.map((t) => t.total_cost), 0.01);
            const width = (item.total_cost / maxCost) * 100;
            return (
              <div key={idx}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-900">{item.day}</span>
                  <span className="text-gray-500">
                    ${item.total_cost.toFixed(4)} · {item.total_tokens.toLocaleString()} tokens
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {item.calls} 次调用
                </div>
              </div>
            );
          })}
          {dailyTrend.length === 0 && (
            <p className="text-center text-sm text-gray-500">暂无数据</p>
          )}
        </div>
      </div>

      {/* 详细分析 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TokenUsage teamId={teamId} />
        <AgentMetrics teamId={teamId} />
      </div>

      {/* 成本归因 */}
      {attribution && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">成本归因</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-medium text-gray-600">按团队</h4>
              <div className="space-y-2">
                {Object.entries(attribution.by_team).map(([team, data]) => (
                  <div key={team} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-900">{team}</span>
                      <span className="text-gray-500">${data.cost_usd.toFixed(4)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {data.tokens.toLocaleString()} tokens · {data.calls} 次调用
                    </div>
                  </div>
                ))}
                {Object.keys(attribution.by_team).length === 0 && (
                  <p className="text-xs text-gray-500">暂无数据</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-gray-600">按 Agent</h4>
              <div className="space-y-2">
                {Object.entries(attribution.by_node)
                  .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
                  .slice(0, 10)
                  .map(([node, data]) => (
                    <div key={node} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-900">{node}</span>
                        <span className="text-gray-500">${data.cost_usd.toFixed(4)}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {data.tokens.toLocaleString()} tokens · {data.calls} 次调用
                      </div>
                    </div>
                  ))}
                {Object.keys(attribution.by_node).length === 0 && (
                  <p className="text-xs text-gray-500">暂无数据</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
