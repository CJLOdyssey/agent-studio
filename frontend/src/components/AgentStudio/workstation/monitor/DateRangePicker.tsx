import { useState, useRef, useEffect } from 'react';

export type PeriodMode = 'preset' | 'custom';

interface DateRangePickerProps {
  periodMode: PeriodMode;
  presetDays: number;
  startDate: string;
  endDate: string;
  onPresetChange: (days: number) => void;
  onCustomChange: (startDate: string, endDate: string) => void;
  presetOptions?: number[];
}

export function DateRangePicker({
  periodMode,
  presetDays,
  startDate,
  endDate,
  onPresetChange,
  onCustomChange,
  presetOptions = [7, 14, 30],
}: DateRangePickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      onCustomChange(startDate, endDate);
      setShowDatePicker(false);
    }
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex gap-2">
        {presetOptions.map((d) => (
          <button
            key={d}
            onClick={() => onPresetChange(d)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              periodMode === 'preset' && presetDays === d
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
            }`}
          >
            {d}天
          </button>
        ))}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              periodMode === 'custom'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
            }`}
          >
            自定义
          </button>
          {showDatePicker && (
            <div className="absolute top-full mt-1 right-0 z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-3 shadow-lg">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--color-text-muted)]">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onCustomChange(e.target.value, endDate)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                />
                <label className="text-xs text-[var(--color-text-muted)]">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onCustomChange(startDate, e.target.value)}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                />
                <button
                  onClick={handleApplyCustom}
                  disabled={!startDate || !endDate}
                  className="rounded bg-[var(--color-accent)] px-3 py-1 text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  应用
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="text-xs text-[var(--color-text-muted)]">
        {periodMode === 'preset'
          ? `最近 ${presetDays} 天`
          : startDate && endDate
            ? `${startDate} ~ ${endDate}`
            : '请选择日期'}
      </div>
    </div>
  );
}
