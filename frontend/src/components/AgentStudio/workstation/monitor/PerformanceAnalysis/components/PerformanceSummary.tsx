import type { PerformanceSummary as SummaryType } from '../../../../../../api/client/cost';
import { MetricCard } from './MetricCard';
import { t } from '../../locales';

interface PerformanceSummaryProps {
  summary: SummaryType;
  period: number;
}

/**
 * 格式化分位数显示
 */
function formatPercentiles(p50?: number, p95?: number): string {
  const parts: string[] = [];
  if (p50 != null && p50 > 0) parts.push(`P50 ${p50.toFixed(2)}s`);
  if (p95 != null && p95 > 0) parts.push(`P95 ${p95.toFixed(2)}s`);
  return parts.length > 0 ? parts.join(' · ') : '-';
}

/**
 * 性能摘要组件（大厂风格：简约）
 */
export function PerformanceSummary({ summary, period }: PerformanceSummaryProps) {
  const isEmpty = summary.total_calls === 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={t('monitor.performance_avg_response')}
        value={isEmpty ? '--' : `${summary.avg_response_time_s.toFixed(2)}s`}
        sub={isEmpty ? '暂无数据' : formatPercentiles(summary.p50_response_time_s, summary.p95_response_time_s)}
        isEmpty={isEmpty}
      />

      <MetricCard
        label={t('monitor.performance_avg_success')}
        value={isEmpty ? '--' : `${summary.avg_success_rate.toFixed(1)}%`}
        sub="目标 > 95%"
        isEmpty={isEmpty}
      />

      <MetricCard
        label={t('monitor.performance_avg_tokens')}
        value={isEmpty ? '--' : summary.avg_tokens_per_call.toLocaleString()}
        sub="效率指标"
        isEmpty={isEmpty}
      />

      <MetricCard
        label={t('monitor.performance_total_calls')}
        value={isEmpty ? '--' : summary.total_calls.toLocaleString()}
        sub={`最近 ${period} 天`}
        isEmpty={isEmpty}
      />
    </div>
  );
}
