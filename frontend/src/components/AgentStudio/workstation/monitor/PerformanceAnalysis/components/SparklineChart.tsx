import { useMemo, memo } from 'react';
import { EChart } from '../../shared/EChart';

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
}

function resolveColor(raw: string): string {
  if (!raw.startsWith('var(')) return raw;
  const varName = raw.replace(/^var\(/, '').replace(/\)$/, '');
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return resolved || raw;
}

function colorWithAlpha(raw: string, alpha: string): string {
  const hex = resolveColor(raw);
  if (!hex.startsWith('#')) return hex;
  return hex + alpha;
}

function SparklineChartInner({ data, color = '#6366f1', height = 32 }: SparklineChartProps) {
  const option = useMemo(() => {
    if (data.length === 0) return null;
    return {
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      xAxis: { type: 'category' as const, show: false, data: data.map((_, i) => i) },
      yAxis: { type: 'value' as const, show: false },
      series: [
        {
          type: 'line' as const,
          data,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: resolveColor(color) },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: colorWithAlpha(color, '40') },
                { offset: 1, color: colorWithAlpha(color, '05') },
              ],
            },
          },
        },
      ],
      animation: false,
    };
  }, [data, color]);

  if (!option) return null;

  return <EChart option={option} style={{ width: '100%', height }} />;
}

export const SparklineChart = memo(SparklineChartInner);
