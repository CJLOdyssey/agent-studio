import { useState, useEffect, useCallback } from 'react';
import {
  fetchPerformanceSummary,
  fetchPerformanceTrend,
  type PerformanceSummary,
  type PerformanceTrendItem,
  type DateRange,
  type TrendGranularity,
} from '../../../../../../api/client/cost';
import { rangeSpanDays } from '../../shared/dateRange';

interface UsePerformanceDataParams {
  teamId?: string;
  range: DateRange;
  granularity: TrendGranularity;
}

export function usePerformanceData({
  teamId,
  range,
  granularity,
}: UsePerformanceDataParams) {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [trend, setTrend] = useState<PerformanceTrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scope = { teamId, range };
  const period = rangeSpanDays(range);

  const runFetch = useCallback(async () => {
    const [summaryData, trendData] = await Promise.all([
      fetchPerformanceSummary(scope),
      fetchPerformanceTrend({ ...scope, granularity }),
    ]);
    return { summaryData, trendData };
  }, [teamId, range, granularity]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setError(null);
        const { summaryData, trendData } = await runFetch();
        if (!cancelled) {
          setSummary(summaryData);
          setTrend(trendData);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [runFetch]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const { summaryData, trendData } = await runFetch();
      setSummary(summaryData);
      setTrend(trendData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [runFetch]);

  return {
    summary,
    trend,
    loading,
    error,
    period,
    refetch,
  };
}
