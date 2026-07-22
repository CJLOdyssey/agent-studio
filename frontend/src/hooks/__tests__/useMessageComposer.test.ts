import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessageComposer } from '../useMessageComposer';

vi.mock('../../utils/validation', () => ({
  validateInput: (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return { valid: false, sanitized: '', error: 'empty' };
    return { valid: true, sanitized: trimmed };
  },
}));

describe('useMessageComposer', () => {
  const onSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty value', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend }));
    expect(result.current.value).toBe('');
    expect(result.current.hasContent).toBe(false);
    expect(result.current.charCount).toBe(0);
  });

  it('sets value via setValue', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend }));
    act(() => result.current.setValue('hello'));
    expect(result.current.value).toBe('hello');
    expect(result.current.hasContent).toBe(true);
    expect(result.current.charCount).toBe(5);
  });

  it('submits valid content and clears', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend }));
    act(() => result.current.setValue('hello'));
    let success: boolean = false;
    act(() => { success = result.current.submit(); });
    expect(success).toBe(true);
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(result.current.value).toBe('');
  });

  it('does not submit empty content', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend }));
    let success: boolean = true;
    act(() => { success = result.current.submit(); });
    expect(success).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('handles Enter key in enter mode', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend, sendMode: 'enter' }));
    act(() => result.current.setValue('hello'));
    const event = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), nativeEvent: { isComposing: false } } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('does not submit on Shift+Enter in enter mode', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend, sendMode: 'enter' }));
    act(() => result.current.setValue('hello'));
    const event = { key: 'Enter', shiftKey: true, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), nativeEvent: { isComposing: false } } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('handles Ctrl+Enter in ctrl-enter mode', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend, sendMode: 'ctrl-enter' }));
    act(() => result.current.setValue('hello'));
    const event = { key: 'Enter', shiftKey: false, ctrlKey: true, metaKey: false, preventDefault: vi.fn(), nativeEvent: { isComposing: false } } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('ignores IME composition events', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend, sendMode: 'enter' }));
    act(() => result.current.setValue('hello'));
    const event = { key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: vi.fn(), nativeEvent: { isComposing: true } } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    act(() => result.current.handleKeyDown(event));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('returns maxLength from options', () => {
    const { result } = renderHook(() => useMessageComposer({ onSend, maxLength: 5000 }));
    expect(result.current.maxLength).toBe(5000);
  });
});
