import { useMemo, useState } from 'react';
import { EChart } from '../../shared/EChart';
import { colorAt, getModelAlias } from '../../shared/chartConstants';
import { formatCost, formatTokens } from '../../shared/format';
import { niceStep } from '../utils/costUtils';
import type { DailyTrendItem, TrendGranularity } from '../../../../../../api/client/cost';

interface CostTrendChartProps {
  /** 后端已按当前粒度聚合好的桶（含空桶，由后端补齐保证 X 轴连续） */
  data: DailyTrendItem[];
  isDark: boolean;
  /** 由范围预设决定（今天/昨天→hour，其余→day）；仅用于格式化轴标签 */
  granularity: TrendGranularity;
  className?: string;
}

type Metric = 'cost' | 'tokens' | 'calls';

/**
 * 指标配置（开闭原则）：新增指标只需追加一项，坐标轴 / tooltip / 图例自动适配。
 */
interface MetricConfig {
  key: Metric;
  label: string;
  /** 展示格式（用于 tooltip 与 Y 轴 label） */
  format: (v: number) => string;
  /** 取数函数：从某模型桶内统计取该指标值 */
  pick: (m: { cost_usd: number; total_tokens: number; calls: number }) => number;
  /** 是否整数计数（调用次数）。是则强制整数步长 */
  isDiscrete: boolean;
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    key: 'cost',
    label: '成本',
    format: (v) => formatCost(v),
    pick: (m) => m.cost_usd,
    isDiscrete: false,
  },
  {
    key: 'tokens',
    label: 'Token',
    format: (v) => formatTokens(v),
    pick: (m) => m.total_tokens,
    isDiscrete: false,
  },
  {
    key: 'calls',
    label: '调用',
    format: (v) => String(Math.round(v)),
    pick: (m) => m.calls,
    isDiscrete: true,
  },
];

/** 空态（后端返回了 0 桶，即整窗无任何记录） */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-80">
      <svg
        className="w-16 h-16 text-[var(--color-text-muted)] opacity-40"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="mt-3 text-base font-medium text-[var(--color-text-primary)]">当前周期无成本记录</p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">调整周期或产生对话后再查看</p>
    </div>
  );
}

/** 空桶 key 判定：桶存在但无 by_model，或全局无消耗。 */
function isEmptyBucket(d: DailyTrendItem): boolean {
  return d.calls === 0 && (!d.by_model || Object.keys(d.by_model).length === 0);
}

export function CostTrendChart({
  data,
  isDark,
  granularity,
  className,
}: CostTrendChartProps) {
  const [metric, setMetric] = useState<Metric>('cost');
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set());

  const activeMetric = METRIC_CONFIGS.find((m) => m.key === metric) ?? METRIC_CONFIGS[0];

  /** 全空判定：后端一个非空桶都没有 */
  const allEmpty = data.length === 0 || data.every(isEmptyBucket);

  /** 有真实消耗的模型集合（cost>0），避免贴零的幽灵序列 */
  const allModels = useMemo(() => {
    const totals = new Map<string, number>();
    data.forEach((d) => {
      Object.entries(d.by_model ?? {}).forEach(([model, m]) => {
        totals.set(model, (totals.get(model) ?? 0) + (m.cost_usd ?? 0));
      });
    });
    return [...totals.entries()]
      .filter(([, total]) => total > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([model]) => model);
  }, [data]);

  const visibleModels = useMemo(
    () => allModels.filter((m) => !hiddenModels.has(m)),
    [allModels, hiddenModels],
  );

  const option = useMemo(() => {
    if (allEmpty) return null;

    // X 轴直接采用后端返回的桶（已补齐空桶），day/week/month 各自带正确的桶跨度。
    const buckets = data.map((d) => d.day);

    const textColor = isDark ? '#a0a5b0' : '#495057';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const bgColor = isDark ? '#1c1e24' : '#ffffff';

    // 趋势图按模型堆叠：顶部 ModelPicker 决定 data 里有哪些模型——
    // 选“所有模型”则多模型堆叠；选中单模型则单根柱。每桶累加 stack 总量供 Y 轴定标。
    const perModelValues: Record<string, number[]> = {};
    const stackTotals: number[] = new Array(data.length).fill(0);
    visibleModels.forEach((model) => {
      const vals = data.map((d, i) => {
        const m = d.by_model?.[model];
        const v = m ? activeMetric.pick(m) : 0;
        stackTotals[i] += v;
        return v;
      });
      perModelValues[model] = vals;
    });
    const maxValue = stackTotals.length > 0 ? Math.max(...stackTotals) : 0;
    const yMax = _yMaxFor(maxValue, activeMetric.isDiscrete);

    const barMaxWidth = granularity === 'day' ? 22 : 34;
    const series = visibleModels.map((model, i) => {
      const color = colorAt(i);
      return {
        name: model,
        type: 'bar' as const,
        stack: 'total' as const,
        barMaxWidth,
        // 只有最顶层 series 显示圆角，避免中间层出现割裂圆角
        itemStyle: {
          color,
          borderRadius:
            i === visibleModels.length - 1
              ? ([3, 3, 0, 0] as [number, number, number, number])
              : ([0, 0, 0, 0] as [number, number, number, number]),
        },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: `${color}55` } },
        data: perModelValues[model],
      };
    });

    return {
      tooltip: {
        trigger: 'axis' as const,
        // 细 crosshair 跟随，不用大块 axisPointer 阴影带
        axisPointer: {
          type: 'line' as const,
          lineStyle: { color: borderColor, width: 1 },
          snap: true,
        },
        backgroundColor: bgColor,
        borderColor,
        textStyle: { color: isDark ? '#f1f1f1' : '#1a1a2e', fontSize: 12 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const list = Array.isArray(params) ? params : [params];
          const row = list[0];
          if (!row) return '';
          const bucket = data[row.dataIndex];
          if (!bucket) return '';

          const title =
            granularity === 'hour'
              ? `${bucket.day.slice(0, 10)} ${bucket.day.slice(11, 13)}:00`
              : granularity === 'month'
                ? `${bucket.day.slice(0, 4)} 年 ${Number(bucket.day.slice(5, 7))} 月`
                : granularity === 'week'
                  ? `${bucket.day.slice(0, 4)}-${bucket.day.slice(5, 7)}-${bucket.day.slice(8)} 起一周`
                  : bucket.day;

          let html = `<div style="font-weight:600;margin-bottom:8px;font-size:13px">${title}</div>`;
          // 逐模型一行，末尾汇总
          let activeTotal = 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          list.forEach((p: any) => {
            const model = String(p.seriesName ?? '');
            const m = bucket.by_model?.[model];
            if (!m) return;
            const value = activeMetric.pick(m);
            activeTotal += value;
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin:4px 0">
              <span style="display:flex;align-items:center;gap:6px">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                <span style="font-size:12px">${getModelAlias(model)}</span>
              </span>
              <span style="font-weight:600;font-size:12px">${activeMetric.format(value)}</span>
            </div>`;
          });
          const totalTokens = list.reduce((s, p) => s + (bucket.by_model?.[String(p.seriesName ?? '')]?.total_tokens ?? 0), 0);
          const totalCalls = list.reduce((s, p) => s + (bucket.by_model?.[String(p.seriesName ?? '')]?.calls ?? 0), 0);
          html += `<div style="border-top:1px solid ${borderColor};margin-top:8px;padding-top:8px;font-size:12px">
            <div style="display:flex;justify-content:space-between;margin:2px 0"><span style="color:${textColor}">总${activeMetric.label}</span><span style="font-weight:600">${activeMetric.format(activeTotal)}</span></div>
            <div style="display:flex;justify-content:space-between;margin:2px 0"><span style="color:${textColor}">总 Token</span><span style="font-weight:600">${totalTokens.toLocaleString()}</span></div>
            <div style="display:flex;justify-content:space-between;margin:2px 0"><span style="color:${textColor}">总调用</span><span style="font-weight:600">${totalCalls} 次</span></div>
          </div>`;

          return html;
        },
      },
      legend: { show: false },
      grid: { left: 10, right: 16, top: 8, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category' as const,
        data: buckets.map(formatBucketLabel(granularity)),
        axisLabel: { fontSize: 11, color: textColor, hideOverlap: true },
        axisLine: { lineStyle: { color: borderColor } },
        axisTick: { show: false },
        boundaryGap: true,
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: yMax.max,
        interval: yMax.step,
        axisLabel: {
          fontSize: 11,
          color: textColor,
          formatter: (value: number) => activeMetric.format(value),
        },
        splitLine: { lineStyle: { color: borderColor, type: 'dashed' as const } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series,
      animationDuration: 400,
      animationEasing: 'cubicOut' as const,
    };
  }, [data, isDark, visibleModels, activeMetric, allEmpty, granularity]);

  return (
    <div className={className}>
      {/* 顶部工具条：仅指标切换（模型维度由顶部 ModelPicker 决定，此处不重复） */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-0.5">
          {METRIC_CONFIGS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                metric === m.key
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {allEmpty ? (
        <EmptyState />
      ) : (
        <EChart option={option!} style={{ width: '100%', height: 320 }} />
      )}

      {/* 图例放底部：多模型才展示，供点隐藏/恢复模型 */}
      {!allEmpty && visibleModels.length > 1 && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {visibleModels.map((model, i) => {
            const isHidden = hiddenModels.has(model);
            return (
              <button
                key={model}
                onClick={() =>
                  setHiddenModels((prev) => {
                    const next = new Set(prev);
                    if (next.has(model)) next.delete(model);
                    else next.add(model);
                    return next;
                  })
                }
                title={model}
                className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all ${
                  isHidden
                    ? 'text-[var(--color-text-muted)] line-through opacity-60'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorAt(i), opacity: isHidden ? 0.3 : 1 }}
                />
                {getModelAlias(model)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatBucketLabel(granularity: TrendGranularity): (day: string) => string {
  return (bucket: string) => {
    // hour 桶标识: 2026-09-03T08:00:00 -> 08 时；否则是 YYYY-MM-DD。
    if (granularity === 'hour') {
      const h = bucket.slice(11, 13);
      return `${h}时`;
    }
    if (granularity === 'month') {
      const m = Number(bucket.slice(5, 7));
      return `${m}月`;
    }
    if (granularity === 'week') return `${bucket.slice(5)} 周`;
    return bucket.slice(5);
  };
}

/** 依桶最大值推导 Y 轴范围；全零时给一个非空最小刻度避免轴压扁。 */
function _yMaxFor(maxValue: number, discrete: boolean): { max: number; step: number } {
  if (maxValue <= 0) {
    return { max: discrete ? 5 : 0.005, step: discrete ? 1 : 0.001 };
  }
  return _ceilToStep(maxValue * 1.2, discrete);
}

/** 把 maxValue*1.2 取 nice 步长整倍数（离散则整数步长）。 */
function _ceilToStep(target: number, discrete: boolean): { max: number; step: number } {
  if (discrete) {
    const step = Math.max(1, Math.round(niceStep(target)));
    return { max: Math.ceil(target / step) * step, step };
  }
  const step = niceStep(target);
  return { max: Math.ceil(target / step) * step, step };
}
