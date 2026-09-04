import type { CostSummary } from '../../../../../../api/client/cost';
import { MetricCard } from '../../shared/MetricCard';
import { getModelAlias } from '../../shared/chartConstants';
import { formatCost, formatTokens } from '../../shared/format';
import type { CostMetrics } from '../utils/costUtils';

interface CostMetricCardsProps {
  summary: CostSummary;
  metrics: CostMetrics;
}

/** 概览指标卡：主值为总量，副值给出人均/日均口径，避免重复展示同一数字。 */
export function CostMetricCards({ summary, metrics }: CostMetricCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="总成本"
        value={formatCost(summary.total_cost_usd)}
        color="var(--color-accent)"
        sub={`日均 $${metrics.avgDailyCost.toFixed(4)}`}
      />
      <MetricCard
        label="总调用"
        value={summary.total_calls.toLocaleString()}
        color="var(--color-success)"
        sub={`均 ${Math.round(metrics.avgTokensPerCall).toLocaleString()} tok/次`}
      />
      <MetricCard
        label="Token 消耗"
        value={formatTokens(summary.total_tokens)}
        color="var(--color-warning)"
        sub={`输入 ${formatTokens(summary.total_prompt_tokens)} · 输出 ${formatTokens(summary.total_completion_tokens)}`}
      />
      <MetricCard
        label="活跃模型"
        value={String(metrics.modelCount)}
        color="#8b5cf6"
        sub={
          metrics.topModel
            ? `TOP ${getModelAlias(metrics.topModel.name)} ${metrics.topModel.percentage.toFixed(1)}%`
            : '暂无模型消耗'
        }
      />
    </div>
  );
}
