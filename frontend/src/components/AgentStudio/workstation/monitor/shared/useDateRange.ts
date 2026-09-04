import { useCallback, useMemo, useState } from 'react';
import type { PeriodMode } from './DateRangePicker';
import { type DateRange, type DateRangeState, DEFAULT_PRESET_DAYS, resolveRange } from './dateRange';

export interface UseDateRangeResult extends DateRangeState {
  /** 绝对区间，请求层唯一使用的时间口径 */
  range: DateRange;
  selectPreset: (days: number) => void;
  selectCustom: (start: string, end: string) => void;
}

/**
 * 日期筛选状态的单一数据源。
 *
 * 组件不再各自维护 mode/preset/start/end 四份 state 并重复推导天数，
 * 成本页与性能页共用同一套语义。
 */
export function useDateRange(initialPresetDays = DEFAULT_PRESET_DAYS): UseDateRangeResult {
  const [mode, setMode] = useState<PeriodMode>('preset');
  const [presetDays, setPresetDays] = useState(initialPresetDays);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const state = useMemo<DateRangeState>(
    () => ({ mode, presetDays, startDate, endDate }),
    [mode, presetDays, startDate, endDate],
  );

  const range = useMemo(() => resolveRange(state), [state]);

  const selectPreset = useCallback((days: number) => {
    setMode('preset');
    setPresetDays(days);
  }, []);

  const selectCustom = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) setMode('custom');
  }, []);

  return {
    mode,
    presetDays,
    startDate,
    endDate,
    range,
    selectPreset,
    selectCustom,
  };
}
