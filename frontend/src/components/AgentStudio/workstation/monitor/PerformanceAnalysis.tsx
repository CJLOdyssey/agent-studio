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
import { DateRangePicker, type PeriodMode } from './DateRangePicker';

interface PerformanceAnalysisProps {
  teamId?: string;
}

export function PerformanceAnalysis({ teamId }: PerformanceAnalysisProps) {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [trend, setTrend] = useState<PerformanceTrendItem[]>([]);
  const [ranking, setRanking] = useState<AgentRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('preset');
  const [presetDays, setPresetDays] = useState(7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 计算实际查询的天数
  const getDaysParam = () => {
    if (periodMode === 'preset') return presetDays;
    if (startDate && endDate) {
      const diff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      return Math.max(1, Math.min(365, diff));
    }
    return 7;
  };

  const period = getDaysParam();

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
  }, [teamId, periodMode, presetDays, startDate, endDate]);

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

  // SVG line chart for response time trend
  const renderResponseTimeChart = () => {
    if (trend.length === 0) return null;
    const w = 600;
    const h = 160;
    const padX = 40;
    const padY = 20;
    const maxTime = Math.max(...trend.map((t) => t.avg_response_time_s), 1);
    const points = trend.map((item, i) => {
      const x = padX + (i / Math.max(trend.length - 1, 1)) * (w - 2 * padX);
      const y = h - padY - (item.avg_response_time_s / maxTime) * (h - 2 * padY);
      return { x, y, item };
    });
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = h - padY - ratio * (h - 2 * padY);
          return (
            <line key={ratio} x1={padX} y1={y} x2={w - padX} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4 2" />
          );
        })}
        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        {/* Points & labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--color-accent)" />
            <text x={p.x} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
              {p.item.time_bucket.slice(5)}
            </text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill="var(--color-text-secondary)">
              {p.item.avg_response_time_s.toFixed(1)}s
            </text>
          </g>
        ))}
        {/* Y axis labels */}
        {[0, 0.5, 1].map((ratio) => {
          const y = h - padY - ratio * (h - 2 * padY);
          const val = (ratio * maxTime).toFixed(1);
          return (
            <text key={ratio} x={padX - 4} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)">
              {val}s
            </text>
          );
        })}
      </svg>
    );
  };

  // SVG line chart for success rate trend
  const renderSuccessRateChart = () => {
    if (trend.length === 0) return null;
    const w = 600;
    const h = 160;
    const padX = 40;
    const padY = 20;
    const points = trend.map((item, i) => {
      const x = padX + (i / Math.max(trend.length - 1, 1)) * (w - 2 * padX);
      const y = h - padY - (item.success_rate / 100) * (h - 2 * padY);
      return { x, y, item };
    });
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = h - padY - ratio * (h - 2 * padY);
          return (
            <line key={ratio} x1={padX} y1={y} x2={w - padX} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4 2" />
          );
        })}
        {/* 95% target line */}
        <line
          x1={padX}
          y1={h - padY - 0.95 * (h - 2 * padY)}
          x2={w - padX}
          y2={h - padY - 0.95 * (h - 2 * padY)}
          stroke="var(--color-warning)"
          strokeWidth="1"
          strokeDasharray="6 3"
        />
        <text x={w - padX + 4} y={h - padY - 0.95 * (h - 2 * padY) + 3} fontSize="8" fill="var(--color-warning)">
          95%
        </text>
        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--color-success)" strokeWidth="2" />
        {/* Points & labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--color-success)" />
            <text x={p.x} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
              {p.item.time_bucket.slice(5)}
            </text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill="var(--color-text-secondary)">
              {p.item.success_rate.toFixed(1)}%
            </text>
          </g>
        ))}
        {/* Y axis labels */}
        {[0, 0.5, 1].map((ratio) => {
          const y = h - padY - ratio * (h - 2 * padY);
          const val = (ratio * 100).toFixed(0);
          return (
            <text key={ratio} x={padX - 4} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)">
              {val}%
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* 时间周期选择 */}
      <DateRangePicker
        periodMode={periodMode}
        presetDays={presetDays}
        startDate={startDate}
        endDate={endDate}
        onPresetChange={(d) => { setPeriodMode('preset'); setPresetDays(d); }}
        onCustomChange={(start, end) => { setStartDate(start); setEndDate(end); setPeriodMode('custom'); }}
      />

      {/* 关键性能指标 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">平均响应时间</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {summary.avg_response_time_s.toFixed(1)}s
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            P50 {summary.p50_response_time_s?.toFixed(1) ?? '-'}s · P95 {summary.p95_response_time_s?.toFixed(1) ?? '-'}s
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
          {renderResponseTimeChart()}
          {trend.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-8">暂无数据</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">成功率趋势</h3>
          {renderSuccessRateChart()}
          {trend.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-8">暂无数据</p>
          )}
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
                  调用次数
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Token 消耗
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  成本
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  平均 Token/次
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
                    {agent.calls.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    {agent.total_tokens.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    ${agent.total_cost_usd.toFixed(4)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">
                    {agent.avg_tokens.toLocaleString()}
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
