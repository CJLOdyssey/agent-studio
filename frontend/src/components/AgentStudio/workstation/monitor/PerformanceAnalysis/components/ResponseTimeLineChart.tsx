import { useMemo, memo } from 'react';
import { EChart } from '../../shared/EChart';
import { getResponseTimeOption } from '../utils/chartOptions';
import { ChartSkeleton } from './ChartSkeleton';
import { t } from '../../locales';
import type { PerformanceTrendItem } from '../../../../../../api/client/cost';

interface ResponseTimeLineChartProps {
  data: PerformanceTrendItem[];
  isDark: boolean;
  loading?: boolean;
}

function ResponseTimeLineChartInner({ data, isDark, loading }: ResponseTimeLineChartProps) {
  const option = useMemo(() => getResponseTimeOption(data, isDark), [data, isDark]);

  if (loading) return <ChartSkeleton height={450} />;

  if (data.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-[450px] rounded-lg border border-dashed border-[var(--color-border)]"
        role="status"
        aria-label={t('monitor.performance_no_response_data')}
      >
        <svg className="w-12 h-12 text-[var(--color-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-base font-medium text-[var(--color-text-primary)]">{t('monitor.performance_no_response_data')}</p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {t('monitor.performance_start_dialog')}
        </p>
      </div>
    );
  }

  return <EChart option={option!} style={{ width: '100%', height: 450 }} />;
}

export const ResponseTimeLineChart = memo(ResponseTimeLineChartInner);
