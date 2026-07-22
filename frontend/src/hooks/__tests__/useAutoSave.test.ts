import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TestProviders } from '../../test/setup';
import { useAutoSave } from '../useAutoSave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves to localStorage after delay when enabled', () => {
    renderHook(() => useAutoSave('test-key', { foo: 'bar' }, true), { wrapper: TestProviders });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('does not save when disabled', () => {
    renderHook(() => useAutoSave('test-key', { foo: 'bar' }, false), { wrapper: TestProviders });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('debounces rapid changes', () => {
    const { rerender } = renderHook(
      ({ data }) => useAutoSave('test-key', data, true),
      { initialProps: { data: { v: 1 } }, wrapper: TestProviders },
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender({ data: { v: 2 } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(localStorage.getItem('test-key')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify({ v: 2 }));
  });

  it('clears timer on unmount', () => {
    const { unmount } = renderHook(() => useAutoSave('test-key', { foo: 'bar' }, true), { wrapper: TestProviders });
    unmount();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('saves complex data structures', () => {
    const data = { nested: { arr: [1, 2, 3], str: 'hello' } };
    renderHook(() => useAutoSave('complex-key', data, true), { wrapper: TestProviders });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(JSON.parse(localStorage.getItem('complex-key')!)).toEqual(data);
  });
});
