import { useState, useEffect, useRef } from 'react';
import {
  fetchCostSummary,
  fetchDailyTrend,
  fetchCostAttribution,
  type CostSummary,
  type DailyTrendItem,
  type CostAttribution,
} from '../../../../api/client/cost';
import { CardSkeleton } from '../shared/LoadingSkeleton';

interface CostDashboardProps {
  teamId?: string;
  onNavigate?: (tab: string) => void;
}

type PeriodMode = 'preset' | 'custom';

export function CostDashboard({ teamId, onNavigate }: CostDashboardProps) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [dailyTrend, setDailyTrend] = useState<DailyTrendItem[]>([]);
  const [attribution, setAttribution] = useState<CostAttribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('preset');
  const [presetDays, setPresetDays] = useState(7);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getDaysParam = () => {
    if (periodMode === 'preset') return presetDays;
    if (startDate && endDate) {
      const diff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
      return Math.max(1, Math.min(365, diff));
    }
    return 7;
  };

  const days = getDaysParam();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [summaryData, trendData, attributionData] = await Promise.all([
          fetchCostSummary(teamId, days),
          fetchDailyTrend(teamId, days),
          fetchCostAttribution(teamId, days),
        ]);
        setSummary(summaryData);
        setDailyTrend(trendData);
        setAttribution(attributionData);
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

  const avgCostPerCall = summary.total_calls > 0 ? summary.total_cost_usd / summary.total_calls : 0;
  const avgTokensPerCall = summary.total_calls > 0 ? summary.total_tokens / summary.total_calls : 0;
  const activeAgents = Object.keys(summary.by_node).length;

  // SVG line chart for cost trend
  const renderTrendChart = () => {
    if (dailyTrend.length === 0) return null;
    const w = 600;
    const h = 160;
    const padX = 40;
    const padY = 20;
    const maxCost = Math.max(...dailyTrend.map((t) => t.total_cost), 0.01);
    const points = dailyTrend.map((item, i) => {
      const x = padX + (i / Math.max(dailyTrend.length - 1, 1)) * (w - 2 * padX);
      const y = h - padY - (item.total_cost / maxCost) * (h - 2 * padY);
      return { x, y, item };
    });
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = `${pathD} L${points[points.length - 1].x},${h - padY} L${points[0].x},${h - padY} Z`;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <defs>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = h - padY - ratio * (h - 2 * padY);
          return (
            <line key={ratio} x1={padX} y1={y} x2={w - padX} y2={y} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="4 2" />
          );
        })}
        {/* Area */}
        <path d={areaD} fill="url(#costGrad)" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        {/* Points & labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--color-accent)" />
            <text x={p.x} y={h - 4} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">
              {p.item.day.slice(5)}
            </text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill="var(--color-text-secondary)">
              ${p.item.total_cost.toFixed(3)}
            </text>
          </g>
        ))}
        {/* Y axis labels */}
        {[0, 0.5, 1].map((ratio) => {
          const y = h - padY - ratio * (h - 2 * padY);
          const val = (ratio * maxCost).toFixed(3);
          return (
            <text key={ratio} x={padX - 4} y={y + 3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)">
              ${val}
            </text>
          );
        })}
      </svg>
    );
  };

  // SVG donut chart for token distribution
  const renderTokenDonut = () => {
    const models = Object.entries(summary.by_model).sort((a, b) => b[1].tokens - a[1].tokens);
    if (models.length === 0) return null;
    const total = models.reduce((s, [, d]) => s + d.tokens, 0);
    const colors = [
      'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)',
      'var(--color-danger)', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
    ];
    let cumAngle = -90;
    const cx = 60;
    const cy = 60;
    const r = 50;
    const ir = 30;
    const slices = models.map(([name, data], i) => {
      const angle = (data.tokens / total) * 360;
      const startAngle = cumAngle;
      const endAngle = cumAngle + angle;
      cumAngle = endAngle;
      const toRad = (a: number) => (a * Math.PI) / 180;
      const largeArc = angle > 180 ? 1 : 0;
      const outerX1 = cx + r * Math.cos(toRad(startAngle));
      const outerY1 = cy + r * Math.sin(toRad(startAngle));
      const outerX2 = cx + r * Math.cos(toRad(endAngle));
      const outerY2 = cy + r * Math.sin(toRad(endAngle));
      const innerX1 = cx + ir * Math.cos(toRad(endAngle));
      const innerY1 = cy + ir * Math.sin(toRad(endAngle));
      const innerX2 = cx + ir * Math.cos(toRad(startAngle));
      const innerY2 = cy + ir * Math.sin(toRad(startAngle));
      const d = [
        `M${outerX1},${outerY1}`,
        `A${r},${r} 0 ${largeArc} 1 ${outerX2},${outerY2}`,
        `L${innerX1},${innerY1}`,
        `A${ir},${ir} 0 ${largeArc} 0 ${innerX2},${innerY2}`,
        'Z',
      ].join(' ');
      return { name, data, d, color: colors[i % colors.length] };
    });

    return (
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
          {slices.map((s) => (
            <path key={s.name} d={s.d} fill={s.color} stroke="var(--color-surface-overlay)" strokeWidth="1" />
          ))}
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--color-text-primary)">
            {(total / 1000).toFixed(1)}K
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">
            tokens
          </text>
        </svg>
        <div className="flex-1 space-y-1.5 min-w-0">
          {slices.map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="truncate text-[var(--color-text-primary)]">{s.name}</span>
              <span className="text-[var(--color-text-muted)] ml-auto shrink-0">
                {((s.data.tokens / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 时间周期选择 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => { setPeriodMode('preset'); setPresetDays(d); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                periodMode === 'preset' && presetDays === d
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
              }`}
            >
              {d}天
            </button>
          ))}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                periodMode === 'custom'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
              }`}
            >
              自定义
            </button>
            {showDatePicker && (
              <div className="absolute top-full mt-1 right-0 z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-3 shadow-lg">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[var(--color-text-muted)]">开始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                  />
                  <label className="text-xs text-[var(--color-text-muted)]">结束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                  />
                  <button
                    onClick={() => { setPeriodMode('custom'); setShowDatePicker(false); }}
                    className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-white"
                  >
                    应用
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">
          {periodMode === 'preset' ? `最近 ${presetDays} 天` : (startDate && endDate ? `${startDate} ~ ${endDate}` : '请选择日期')}
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">总成本</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            ${summary.total_cost_usd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            平均 ${avgCostPerCall.toFixed(4)}/次
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">总调用次数</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {summary.total_calls.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            平均 {Math.round(avgTokensPerCall).toLocaleString()} tokens/次
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">总 Token 消耗</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {(summary.total_tokens / 1000).toFixed(1)}K
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            Prompt {(summary.total_prompt_tokens / 1000).toFixed(1)}K · Completion {(summary.total_completion_tokens / 1000).toFixed(1)}K
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <div className="text-xs text-[var(--color-text-muted)]">活跃 Agent 数</div>
          <div className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
            {activeAgents}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-muted)]">
            {Object.keys(summary.by_model).length} 个模型
          </div>
        </div>
      </div>

      {/* 成本趋势图 */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">成本趋势</h3>
        {renderTrendChart()}
        {dailyTrend.length === 0 && (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-8">暂无数据</p>
        )}
      </div>

      {/* Token 分布 + Agent 成本分布 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Token 消耗分布</h3>
          {renderTokenDonut()}
          {(!summary.by_model || Object.keys(summary.by_model).length === 0) && (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-4">暂无数据</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">Agent 成本分布</h3>
          <div className="space-y-3">
            {Object.entries(summary.by_node)
              .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
              .slice(0, 8)
              .map(([nodeId, data]) => {
                const maxCost = Math.max(...Object.values(summary.by_node).map((d) => d.cost_usd), 0.01);
                const width = (data.cost_usd / maxCost) * 100;
                return (
                  <div key={nodeId}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--color-text-primary)] truncate">{nodeId}</span>
                      <span className="text-[var(--color-text-muted)] shrink-0 ml-2">
                        ${data.cost_usd.toFixed(4)} · {data.calls}次
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(summary.by_node).length === 0 && (
              <p className="text-center text-sm text-[var(--color-text-muted)] py-4">暂无数据</p>
            )}
          </div>
        </div>
      </div>

      {/* 成本归因 */}
      {attribution && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
          <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">成本归因</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <h4 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">按团队</h4>
              <div className="space-y-2">
                {Object.entries(attribution.by_team).map(([team, data]) => (
                  <div key={team} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--color-text-primary)]">{team}</span>
                      <span className="text-[var(--color-text-muted)]">${data.cost_usd.toFixed(4)}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {data.tokens.toLocaleString()} tokens · {data.calls} 次调用
                      {data.percentage !== undefined && ` · ${data.percentage}%`}
                    </div>
                  </div>
                ))}
                {Object.keys(attribution.by_team).length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">暂无数据</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">按 Agent</h4>
              <div className="space-y-2">
                {Object.entries(attribution.by_node)
                  .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
                  .slice(0, 10)
                  .map(([node, data]) => (
                    <div key={node} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--color-text-primary)]">{node}</span>
                        <span className="text-[var(--color-text-muted)]">${data.cost_usd.toFixed(4)}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {data.tokens.toLocaleString()} tokens · {data.calls} 次调用
                        {data.percentage !== undefined && ` · ${data.percentage}%`}
                      </div>
                    </div>
                  ))}
                {Object.keys(attribution.by_node).length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">暂无数据</p>
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">按模型</h4>
              <div className="space-y-2">
                {Object.entries(attribution.by_model)
                  .sort((a, b) => b[1].cost_usd - a[1].cost_usd)
                  .map(([model, data]) => (
                    <div key={model} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--color-text-primary)]">{model}</span>
                        <span className="text-[var(--color-text-muted)]">${data.cost_usd.toFixed(4)}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {data.tokens.toLocaleString()} tokens · {data.calls} 次调用
                        {data.percentage !== undefined && ` · ${data.percentage}%`}
                      </div>
                    </div>
                  ))}
                {Object.keys(attribution.by_model).length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">暂无数据</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 模型定价参考 - 改为官方链接 */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">模型定价参考</h3>
        <div className="space-y-2">
          <a
            href="https://openai.com/api/pricing/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline"
          >
            OpenAI 官方定价 →
          </a>
          <a
            href="https://api-docs.deepseek.com/quick_start/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline"
          >
            DeepSeek 官方定价 →
          </a>
          <a
            href="https://www.anthropic.com/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-[var(--color-accent)] hover:underline"
          >
            Anthropic 官方定价 →
          </a>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          注：实际计费以各平台官方最新定价为准，本地价格仅供参考。
        </p>
      </div>
    </div>
  );
}
