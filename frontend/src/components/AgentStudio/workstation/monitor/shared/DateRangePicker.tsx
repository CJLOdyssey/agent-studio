import { useState, useRef, useEffect, useMemo } from 'react';

export type PeriodMode = 'preset' | 'custom';

interface DateRangePickerProps {
  periodMode: PeriodMode;
  presetDays: number;
  startDate: string;
  endDate: string;
  onPresetChange: (days: number) => void;
  onCustomChange: (startDate: string, endDate: string) => void;
  /** 预设范围（天）。大厂约束：选项 ≤4，太多会成噪声。 */
  presetOptions?: number[];
}

const PRESET_LABELS: Record<number, string> = {
  7: '近 7 天',
  14: '近 14 天',
  30: '近 30 天',
  90: '近 90 天',
};

/**
 * 范围选择器（大厂惯例）：
 * - 预设为主：常用范围一键切换（近 7/30/90 天）。
 * - “自定义”才展开起止日期面板；已选自定义时按钮显示解析后的绝对区间。
 *
 * 与“粒度”正交：这里只管窗口大小，桶宽由图表粒度控件单独控制。
 * 共用组件，保持 props 不变以兼容 PerformanceAnalysis。
 */
export function DateRangePicker({
  periodMode,
  presetDays,
  startDate,
  endDate,
  onPresetChange,
  onCustomChange,
  presetOptions = [7, 14, 30],
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 预设选项只保留在映射表内的，避免出现无中文名的天数。
  const options = useMemo(
    () => presetOptions.filter((d) => PRESET_LABELS[d] != null),
    [presetOptions],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isCustomActive = periodMode === 'custom';
  const customDisplay =
    startDate && endDate ? `${shortDate(startDate)} ~ ${shortDate(endDate)}` : '';

  const handleApply = () => {
    if (startDate && endDate && startDate <= endDate) {
      onCustomChange(startDate, endDate);
      setOpen(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-1">
      {options.map((d) => (
        <button
          key={d}
          onClick={() => onPresetChange(d)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            periodMode === 'preset' && presetDays === d
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          {PRESET_LABELS[d]}
        </button>
      ))}

      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setOpen(!open)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            isCustomActive
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {isCustomActive && customDisplay ? customDisplay : '自定义'}
        </button>

        {open && (
          <div
            className="absolute top-full left-0 mt-1.5 z-50 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">开始</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onCustomChange(e.target.value, endDate)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--color-text-muted)]">结束</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => onCustomChange(startDate, e.target.value)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              {startDate && endDate && startDate > endDate && (
                <span className="text-xs text-[var(--color-danger)]">结束不能早于开始</span>
              )}
              <button
                onClick={() => setOpen(false)}
                className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                取消
              </button>
              <button
                onClick={handleApply}
                disabled={!startDate || !endDate || startDate > endDate}
                className="px-3 py-1 text-xs font-medium rounded bg-[var(--color-accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                应用
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function shortDate(iso: string): string {
  return iso.slice(5); // YYYY-MM-DD -> MM-DD
}
