import { useCallback, useMemo, useState } from 'react';
import type { DateRange } from '../../../../../../api/client/cost';
import { resolvePreset, type RangePreset } from '../../shared/rangePreset';

/**
 * 成本页范围状态：用「预设下拉」单一驱动 window + 桶粒度。
 * 取代旧的 useDateRange（preset 天数）+ 独立 granularity 双状态模型，
 * 使范围选择符合“今天→小时、近7天→按天”的大厂预设语义。
 */
export function useRangePreset(initial: RangePreset = 'today') {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const resolved = useMemo(
    () => resolvePreset(preset, new Date(), customRange ?? undefined),
    [preset, customRange],
  );

  const selectPreset = useCallback((next: RangePreset) => {
    setPreset(next);
    // 切到非自定义时保留上次自定义区间以便切回
  }, []);

  const applyCustom = useCallback((range: DateRange) => {
    setCustomRange(range);
    setPreset('custom');
  }, []);

  return {
    preset,
    range: resolved.range,
    granularity: resolved.granularity,
    customRange,
    selectPreset,
    applyCustom,
  };
}
