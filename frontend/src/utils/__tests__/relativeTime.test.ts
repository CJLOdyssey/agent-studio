import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '../relativeTime';

const NOW = new Date('2026-08-02T10:00:00');

describe('formatRelativeTime', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 「—」 for empty input', () => {
    expect(formatRelativeTime('')).toBe('—');
  });

  it('returns 「—」 for invalid input', () => {
    expect(formatRelativeTime('not-a-date')).toBe('—');
    expect(formatRelativeTime('2026-13-99T99:99:99')).toBe('—');
  });

  it('returns 「刚刚」 for under 1 minute', () => {
    expect(formatRelativeTime('2026-08-02T09:59:31')).toBe('刚刚');
    expect(formatRelativeTime('2026-08-02T09:59:01')).toBe('刚刚');
  });

  it('returns 「N 分钟前」 for under 60 minutes', () => {
    expect(formatRelativeTime('2026-08-02T09:55:00')).toBe('5 分钟前');
    expect(formatRelativeTime('2026-08-02T09:01:00')).toBe('59 分钟前');
  });

  it('returns 「1 分钟前」 for exactly 60 seconds ago', () => {
    expect(formatRelativeTime('2026-08-02T09:59:00')).toBe('1 分钟前');
  });

  it('returns 「N 小时前」 for under 24 hours, even crossing midnight', () => {
    expect(formatRelativeTime('2026-08-02T09:00:00')).toBe('1 小时前');
    expect(formatRelativeTime('2026-08-01T11:00:00')).toBe('23 小时前');
  });

  it('returns 「昨天」 for the previous calendar day', () => {
    expect(formatRelativeTime('2026-08-01T08:00:00')).toBe('昨天');
    expect(formatRelativeTime('2026-08-01T10:00:00')).toBe('昨天');
  });

  it('returns 「N 天前」 for 1-6 calendar days ago', () => {
    expect(formatRelativeTime('2026-07-31T09:00:00')).toBe('2 天前');
    expect(formatRelativeTime('2026-07-27T09:00:00')).toBe('6 天前');
  });

  it('returns local YYYY-MM-DD for 7+ calendar days ago', () => {
    const iso = '2026-07-25T09:00:00';
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(formatRelativeTime(iso)).toBe(expected);
  });

  it('returns local YYYY-MM-DD when elapsed time < 7 days but spans 7 natural days', () => {
    const iso = '2026-07-26T11:00:00';
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(formatRelativeTime(iso)).toBe(expected);
  });

  it('returns local YYYY-MM-DD for far past dates', () => {
    const iso = '2020-01-05T12:00:00';
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(formatRelativeTime(iso)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(formatRelativeTime(iso)).toBe(expected);
  });
});
