import { AlertCircle } from 'lucide-react';
import { RangePresetPicker } from '../shared/RangePresetPicker';
import { useRangePreset } from '../CostAnalysis/hooks/useRangePreset';
import { useIsDarkMode } from '../shared/useIsDarkMode';
import { CardSkeleton } from '../../shared/LoadingSkeleton';
import { usePerformanceData } from './hooks/usePerformanceData';
import { PerformanceSummary } from './components/PerformanceSummary';
import { ResponseTimeLineChart } from './components/ResponseTimeLineChart';
import { SuccessRateLineChart } from './components/SuccessRateLineChart';
import { t } from '../locales';

interface PerformanceAnalysisProps {
  teamId?: string;
}

/**
 * 性能分析主组件（大厂风格）
 *
 * 设计原则：
 * 1. 信息密度：紧凑布局，减少滚动
 * 2. 视觉层级：指标卡片 > 趋势图表 > 排行表格
 * 3. 状态反馈：加载态、空状态、错误态、正常态
 */
export function PerformanceAnalysis({ teamId }: PerformanceAnalysisProps) {
  const isDark = useIsDarkMode();
  const { preset, range, granularity, customRange, selectPreset, applyCustom } = useRangePreset('last7');

  const { summary, trend, loading, error, period, refetch } = usePerformanceData({
    teamId,
    range,
    granularity,
  });

  // 加载态：骨架屏
  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <CardSkeleton count={4} />
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6">
          <div className="h-5 w-32 rounded bg-[var(--color-surface-hover)] animate-pulse mb-4" />
          <div className="h-[400px] rounded bg-[var(--color-surface-hover)] animate-pulse" />
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6">
          <div className="h-5 w-32 rounded bg-[var(--color-surface-hover)] animate-pulse mb-4" />
          <div className="h-[400px] rounded bg-[var(--color-surface-hover)] animate-pulse" />
        </div>
      </div>
    );
  }

  // 错误态
  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5 text-[var(--color-danger)]" size={20} />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-[var(--color-danger)]">数据加载失败</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{error}</p>
            <button
              onClick={refetch}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-[var(--color-accent)] rounded-lg hover:opacity-90 transition-opacity"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 日期选择器 */}
      <RangePresetPicker
        preset={preset}
        onPresetChange={selectPreset}
        customRange={customRange}
        onCustomApply={applyCustom}
      />

      {/* 指标卡片 */}
      <PerformanceSummary summary={summary!} period={period} />

      {/* 响应时间趋势图 */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t('monitor.performance_response_trend')}
        </h3>
        <div className="mt-4">
          <ResponseTimeLineChart data={trend} isDark={isDark} loading={loading && !!summary} />
        </div>
      </div>

      {/* 成功率趋势图 */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t('monitor.performance_success_trend')}
        </h3>
        <div className="mt-4">
          <SuccessRateLineChart data={trend} isDark={isDark} loading={loading && !!summary} />
        </div>
      </div>
    </div>
  );
}
