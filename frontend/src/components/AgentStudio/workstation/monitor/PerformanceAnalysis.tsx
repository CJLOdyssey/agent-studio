import { useState, useEffect } from 'react';
import {
  fetchPerformanceSummary,
  fetchPerformanceTrend,
  fetchAgentRanking,
  type PerformanceSummary,
  type PerformanceTrendItem,
  type AgentRankingItem,
} from '../../../../api/client/cost';
import { CardSkeleton } from '../shared/LoadingSkeleton';

interface PerformanceAnalysisProps {
  teamId?: string;
}

export function PerformanceAnalysis({ teamId }: PerformanceAnalysisProps) {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [trend, setTrend] = useState<PerformanceTrendItem[]>([]);
  const [ranking, setRanking] = useState<AgentRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(7);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, trendData, rankingData] = await Promise.all([
          fetchPerformanceSummary(teamId, period),
          fetchPerformanceTrend(teamId, period),
          fetchAgentRanking(teamId, period),
        ]);
        setSummary(summaryData);
        setTrend(trendData);
        setRanking(rankingData);
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
      <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-4">
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const maxResponseTime = Math.max(...trend.map((t) => t.avg_response_time_s), 1);
  const maxSuccessRate = 100;

  return (
    <div className="space-y-6">
      {/* 时间周期选择 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">性能分析</h2>
        <div className="flex gap-2">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === days
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
              }`}
            >
              {days}天
            </button>
          ))}
        </div>
      </div>

      {/* 关键性能指标 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">平均响应时间</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {summary.avg_response_time_s.toFixed(1)}s
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            最近 {period} 天
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">平均成功率</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {summary.avg_success_rate.toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            目标 &gt; 95%
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">平均 Token/次</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {summary.avg_tokens_per_call.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            效率指标
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">总调用次数</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {summary.total_calls.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            最近 {period} 天
          </div>
        </div>
      </div>

      {/* 性能趋势图 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">响应时间趋势</h3>
          <div className="space-y-2">
            {trend.map((item, idx) => {
              const width = (item.avg_response_time_s / maxResponseTime) * 100;
              return (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-text-primary)]">{item.time_bucket}</span>
                    <span className="text-[var(--color-text-muted)]">{item.avg_response_time_s.toFixed(1)}s</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {item.calls} 次调用
                  </div>
                </div>
              );
            })}
            {trend.length === 0 && (
              <p className="text-center text-sm text-[var(--color-text-muted)]">暂无数据</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">成功率趋势</h3>
          <div className="space-y-2">
            {trend.map((item, idx) => {
              const width = (item.success_rate / maxSuccessRate) * 100;
              const barColor = item.success_rate >= 95 ? 'var(--color-success)' : item.success_rate >= 80 ? 'var(--color-warning)' : 'var(--color-danger)';
              return (
                <div key={idx}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--color-text-primary)]">{item.time_bucket}</span>
                    <span className="text-[var(--color-text-muted)]">{item.success_rate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${width}%`, background: barColor }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {item.calls} 次调用
                  </div>
                </div>
              );
            })}
            {trend.length === 0 && (
              <p className="text-center text-sm text-[var(--color-text-muted)]">暂无数据</p>
            )}
          </div>
        </div>
      </div>

      {/* Agent 性能排行 */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Agent 性能排行</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--color-border)]">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Agent
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  响应时间
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  成功率
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  调用次数
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Token 消耗
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {ranking.map((agent) => (
                <tr key={agent.node_id}>
                  <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
                    {agent.node_id}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    {agent.avg_response_time_s.toFixed(1)}s
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    <span style={{ color: agent.success_rate >= 95 ? 'var(--color-success)' : agent.success_rate >= 80 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                      {agent.success_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    {agent.total_calls.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    {agent.total_tokens.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ranking.length === 0 && (
            <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">暂无数据</p>
          )}
        </div>
      </div>
    </div>
  );
}
