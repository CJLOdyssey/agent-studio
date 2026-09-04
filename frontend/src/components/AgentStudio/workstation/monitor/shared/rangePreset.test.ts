import { describe, it, expect } from 'vitest';
import { resolvePreset } from './rangePreset';

describe('resolvePreset', () => {
  // 固定"今天"便于测试（2026-09-03 周四）
  const today = new Date(2026, 8, 3, 10, 0); // local

  it('today → single-day window, hour granularity', () => {
    const r = resolvePreset('today', today);
    expect(r.range).toEqual({ start: '2026-09-03', end: '2026-09-03' });
    expect(r.granularity).toBe('hour');
  });

  it('yesterday → previous day, hour granularity', () => {
    const r = resolvePreset('yesterday', today);
    expect(r.range).toEqual({ start: '2026-09-02', end: '2026-09-02' });
    expect(r.granularity).toBe('hour');
  });

  it('last7 → 7-day window (incl today), day granularity', () => {
    const r = resolvePreset('last7', today);
    expect(r.range).toEqual({ start: '2026-08-28', end: '2026-09-03' });
    expect(r.granularity).toBe('day');
  });

  it('last30 → 30-day window, day granularity', () => {
    const r = resolvePreset('last30', today);
    expect(r.range).toEqual({ start: '2026-08-05', end: '2026-09-03' });
    expect(r.granularity).toBe('day');
  });

  it('thisMonth → from 1st to today, day granularity', () => {
    const r = resolvePreset('thisMonth', today);
    expect(r.range).toEqual({ start: '2026-09-01', end: '2026-09-03' });
    expect(r.granularity).toBe('day');
  });

  it('lastMonth → full previous calendar month', () => {
    const r = resolvePreset('lastMonth', today);
    expect(r.range).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(r.granularity).toBe('day');
  });

  it('custom → uses provided range, day granularity', () => {
    const r = resolvePreset('custom', today, { start: '2026-05-10', end: '2026-05-20' });
    expect(r.range).toEqual({ start: '2026-05-10', end: '2026-05-20' });
    expect(r.granularity).toBe('day');
  });
});
