import { useMemo, memo } from 'react';
import { EChart } from '../../shared/EChart';
import { getSuccessRateOption } from '../utils/chartOptions';
import { ChartSkeleton } from './ChartSkeleton';
import { t } from '../../locales';
import type { PerformanceTrendItem } from '../../../../../../api/client/cost';

interface SuccessRateLineChartProps {
  data: PerformanceTrendItem[];
  isDark: boolean;
  loading?: boolean;
}

function SuccessRateLineChartInner({ data, isDark, loading }: SuccessRateLineChartProps) {
  const option = useMemo(() => getSuccessRateOption(data, isDark), [data, isDark]);

  if (loading) return <ChartSkeleton height={450} />;

  if (data.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-[450px] rounded-lg border border-dashed border-[var(--color-border)]"
        role="status"
        aria-label={t('monitor.performance_no_success_data')}
      >
        <svg className="w-12 h-12 text-[var(--color-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-base font-medium text-[var(--color-text-primary)]">{t('monitor.performance_no_success_data')}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {t('monitor.performance_start_dialog')}
        </p>
      </div>
    );
  }

  return <EChart option={option!} style={{ width: '100%', height: 450 }} />;
}

export const SuccessRateLineChart = memo(SuccessRateLineChartInner);
