import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRESET_OPTIONS,
  type RangePreset,
  type ResolvedPreset,
  resolvePreset,
} from './rangePreset';
import type { DateRange } from '../../../../../api/client/cost';

interface RangePresetPickerProps {
  preset: RangePreset;
  onPresetChange: (preset: RangePreset) => void;
  /** 自定义模式下的起止；由上层持有，跨重渲染保留 */
  customRange: DateRange | null;
  onCustomApply: (range: DateRange) => void;
}

const short = (iso: string) => iso.slice(5);

/** 快捷日期范围选项 */
const QUICK_RANGES = [
  { label: '最近 7 天', days: 7 },
  { label: '最近 14 天', days: 14 },
  { label: '最近 30 天', days: 30 },
  { label: '最近 90 天', days: 90 },
] as const;

/** 生成 YYYY-MM-DD 格式的日期 */
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 偏移天数 */
function offsetDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * 大厂风格单下拉范围选择器：今天/昨天/近7天/近30天/本月/上月/自定义。
 * 自定义展开独立弹窗，支持快捷选择和日期选择器。
 */
export function RangePresetPicker({
  preset,
  onPresetChange,
  customRange,
  onCustomApply,
}: RangePresetPickerProps) {
  const [open, setOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [draftStart, setDraftStart] = useState(customRange?.start ?? '');
  const [draftEnd, setDraftEnd] = useState(customRange?.end ?? '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDraftStart(customRange?.start ?? '');
    setDraftEnd(customRange?.end ?? '');
  }, [customRange]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 点击外部关闭下拉框
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 点击外部关闭弹窗
  useEffect(() => {
    if (!showCustomModal) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowCustomModal(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCustomModal]);

  const activeLabel = useMemo(
    () => PRESET_OPTIONS.find((o) => o.key === preset)?.label ?? '自定义',
    [preset],
  );

  const invalid = !!(draftStart && draftEnd && draftStart > draftEnd);

  const handlePresetClick = (key: RangePreset) => {
    if (key === 'custom') {
      setShowCustomModal(true);
      setOpen(false);
    } else {
      onPresetChange(key);
      setOpen(false);
    }
  };

  const applyCustom = () => {
    if (draftStart && draftEnd && draftStart <= draftEnd) {
      onCustomApply({ start: draftStart, end: draftEnd });
      onPresetChange('custom');
      setShowCustomModal(false);
    }
  };

  const handleQuickRange = (days: number) => {
    const end = new Date();
    const start = offsetDays(end, -(days - 1));
    setDraftStart(formatDate(start));
    setDraftEnd(formatDate(end));
  };

  const getDisplayText = () => {
    if (preset === 'custom' && customRange) {
      return `${short(customRange.start)} ~ ${short(customRange.end)}`;
    }
    return activeLabel;
  };

  return (
    <>
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] transition-colors"
        >
          <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {getDisplayText()}
          <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 z-40 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] py-1 shadow-lg">
            {PRESET_OPTIONS.map((opt) => {
              const active = preset === opt.key;
              const label = opt.label || opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handlePresetClick(opt.key)}
                  style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                  className={`block w-full whitespace-nowrap text-left px-3 py-2 text-sm transition-colors ${
                    active ? 'font-medium bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-surface-hover)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 自定义日期选择弹窗 */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            ref={modalRef}
            className="w-[480px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] shadow-2xl overflow-hidden"
            style={{ animation: 'modalFadeIn 0.2s ease' }}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">选择日期范围</h3>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-5">
              {/* 快捷选择 */}
              <div className="mb-5">
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-3">快捷选择</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_RANGES.map((qr) => {
                    const isActive =
                      draftStart === formatDate(offsetDays(new Date(), -(qr.days - 1))) &&
                      draftEnd === formatDate(new Date());
                    return (
                      <button
                        key={qr.days}
                        type="button"
                        onClick={() => handleQuickRange(qr.days)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          isActive
                            ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                        }`}
                      >
                        {qr.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 日期选择器 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">开始日期</label>
                  <input
                    type="date"
                    value={draftStart}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">结束日期</label>
                  <input
                    type="date"
                    value={draftEnd}
                    min={draftStart || undefined}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-shadow"
                  />
                </div>
              </div>

              {/* 错误提示 */}
              {invalid && (
                <p className="mt-3 text-xs text-[var(--color-danger)] flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  结束日期不能早于开始日期
                </p>
              )}

              {/* 已选范围提示 */}
              {draftStart && draftEnd && !invalid && (
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  已选择 <span className="font-medium text-[var(--color-text-primary)]">{draftStart}</span> 至 <span className="font-medium text-[var(--color-text-primary)]">{draftEnd}</span>
                </p>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!draftStart || !draftEnd || invalid}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}

export type { RangePreset, ResolvedPreset };
export { resolvePreset, PRESET_OPTIONS };
