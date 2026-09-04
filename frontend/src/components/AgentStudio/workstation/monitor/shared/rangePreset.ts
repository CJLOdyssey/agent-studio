import type { TrendGranularity, DateRange } from '../../../../../api/client/cost';

/**
 * 范围预设模型（GA / Mixpanel / Vercel 风格）。
 *
 * 单一职责：把用户选的预设选项，映射成「查询窗口 + 桶粒度 + 展示文案」。
 * 窗口与桶宽由预设一并决定（今天/昨天 → hour；其余 → day），
 * 不需要前端再把“范围”和“粒度”分成两个正交控件。
 */

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export interface ResolvedPreset {
  preset: RangePreset;
  label: string;
  range: DateRange;
  /** 该预设暗示的桶宽 */
  granularity: TrendGranularity;
}

export const PRESET_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: 'last7', label: '近 7 天' },
  { key: 'last30', label: '近 30 天' },
  { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'custom', label: '自定义' },
];

/** 本地时区 YYYY-MM-DD */
function dkey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetDays(d: Date, n: number): Date {
  const c = new Date(d.getTime());
  c.setDate(c.getDate() + n);
  return c;
}

/** “今天 00:00”与“现在”都按本地日期，day 边界走本地而非 UTC。 */
export function resolvePreset(
  preset: RangePreset,
  today = new Date(),
  customRange?: DateRange,
): ResolvedPreset {
  const now = today;
  const todayStr = dkey(now);

  switch (preset) {
    case 'today':
      return {
        preset,
        label: '今天',
        range: { start: todayStr, end: todayStr },
        granularity: 'hour',
      };
    case 'yesterday':
      return {
        preset,
        label: '昨天',
        range: { start: dkey(offsetDays(now, -1)), end: dkey(offsetDays(now, -1)) },
        granularity: 'hour',
      };
    case 'last7':
      return {
        preset,
        label: '近 7 天',
        range: { start: dkey(offsetDays(now, -6)), end: todayStr },
        granularity: 'day',
      };
    case 'last30':
      return {
        preset,
        label: '近 30 天',
        range: { start: dkey(offsetDays(now, -29)), end: todayStr },
        granularity: 'day',
      };
    case 'thisMonth':
      return {
        preset,
        label: '本月',
        range: { start: `${todayStr.slice(0, 7)}-01`, end: todayStr },
        granularity: 'day',
      };
    case 'lastMonth': {
      const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstLast = new Date(firstThis.getTime());
      firstLast.setMonth(firstLast.getMonth() - 1);
      const lastLast = new Date(firstThis.getTime());
      lastLast.setDate(0); // 上月末
      return {
        preset,
        label: '上月',
        range: { start: dkey(firstLast), end: dkey(lastLast) },
        granularity: 'day',
      };
    }
    case 'custom':
      return {
        preset,
        label: customRange && customRange.start && customRange.end ? '自定义' : '自定义',
        range: customRange ?? { start: todayStr, end: todayStr },
        granularity: 'day',
      };
  }
}
