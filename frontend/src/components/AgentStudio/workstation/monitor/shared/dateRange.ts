/**
 * 日期区间领域模型。
 *
 * 单一职责：把「预设 N 天 / 自定义起止」两种 UI 状态，统一降维成绝对日期区间。
 * 请求层只认 DateRange，不再有「天数」这个概念，从根本上杜绝
 * “选了 3/1~3/10 实际查最近 9 天” 这类语义错配。
 */
import type { PeriodMode } from './DateRangePicker';

export interface DateRange {
  /** YYYY-MM-DD，闭区间起点 */
  start: string;
  /** YYYY-MM-DD，闭区间终点 */
  end: string;
}

export interface DateRangeState {
  mode: PeriodMode;
  presetDays: number;
  startDate: string;
  endDate: string;
}

export const DEFAULT_PRESET_DAYS = 7;

/** 本地时区的 YYYY-MM-DD（不使用 toISOString，避免 UTC 偏移导致的跨日）。 */
export function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDays(d: Date, days: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** 把「最近 N 天」换算为绝对区间（含今天）。 */
export function presetToRange(presetDays: number, today = new Date()): DateRange {
  return {
    start: toDateKey(shiftDays(today, -(presetDays - 1))),
    end: toDateKey(today),
  };
}

/**
 * 解析当前筛选状态为绝对区间。
 * 自定义模式缺少任一日期时，回退到默认预设，保证下游拿到的区间始终可用。
 */
export function resolveRange(state: DateRangeState, today = new Date()): DateRange {
  if (state.mode === 'custom' && state.startDate && state.endDate) {
    const [start, end] =
      state.startDate <= state.endDate
        ? [state.startDate, state.endDate]
        : [state.endDate, state.startDate];
    return { start, end };
  }
  return presetToRange(state.presetDays, today);
}

/** 区间跨度天数（含两端），用于展示与日均计算。 */
export function rangeSpanDays(range: DateRange): number {
  const start = new Date(`${range.start}T00:00:00`).getTime();
  const end = new Date(`${range.end}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** 生成区间内的完整日期列表（YYYY-MM-DD），用于图表补零。 */
export function enumerateDateRange(range: DateRange): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime())) return dates;
  // 防御异常区间导致的死循环
  for (let guard = 0; cursor <= end && guard < 366; guard += 1) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
