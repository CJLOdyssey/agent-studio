import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '../useCopyToClipboard';

describe('useCopyToClipboard', { tags: ['unit'] }, () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    vi.useFakeTimers();
  });

  it('copies text and returns true', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    let success = false;
    await act(async () => {
      success = await result.current.copy('hello');
    });
    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('isCopied returns true after copy', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('test', 'key1');
    });
    expect(result.current.isCopied('key1')).toBe(true);
  });

  it('isCopied returns false after timeout', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('test', 'key1');
    });
    expect(result.current.isCopied('key1')).toBe(true);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.isCopied('key1')).toBe(false);
  });

  it('isCopied uses default key when not provided', async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => {
      await result.current.copy('test');
    });
    expect(result.current.isCopied()).toBe(true);
  });
});
