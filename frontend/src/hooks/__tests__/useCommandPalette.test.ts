import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandPalette } from '../useCommandPalette';
import type { CommandOption } from '../../types/input';

const commands: CommandOption[] = [
  { id: 'c1', name: 'help', description: 'Show help', category: 'system' },
  { id: 'c2', name: 'clear', description: 'Clear chat', category: 'system' },
  { id: 'c3', name: 'export', description: 'Export conversation', category: 'system' },
];

function makeEvent(key: string, overrides: Record<string, unknown> = {}): React.KeyboardEvent<HTMLTextAreaElement> {
  return {
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    nativeEvent: { isComposing: false },
    ...overrides,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
}

describe('useCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initially closed with all commands', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    expect(result.current.open).toBe(false);
    expect(result.current.filtered).toEqual(commands);
  });

  it('opens on / at start of empty value', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    const event = makeEvent('/');
    act(() => {
      result.current.handleKeyDown(event, '');
    });
    expect(result.current.open).toBe(true);
  });

  it('opens on / after space', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    const event = makeEvent('/');
    act(() => {
      result.current.handleKeyDown(event, 'hello ');
    });
    expect(result.current.open).toBe(true);
  });

  it('does not open on / in middle of word', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    const event = makeEvent('/');
    act(() => {
      result.current.handleKeyDown(event, 'hello');
    });
    expect(result.current.open).toBe(false);
  });

  it('closes on Escape', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.handleKeyDown(makeEvent('Escape'), '/he');
    });
    expect(result.current.open).toBe(false);
  });

  it('navigates down with ArrowDown', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    expect(result.current.activeIndex).toBe(0);
    act(() => {
      result.current.handleKeyDown(makeEvent('ArrowDown'), '/');
    });
    expect(result.current.activeIndex).toBe(1);
  });

  it('navigates up with ArrowUp', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    act(() => {
      result.current.handleKeyDown(makeEvent('ArrowDown'), '/');
    });
    act(() => {
      result.current.handleKeyDown(makeEvent('ArrowDown'), '/');
    });
    expect(result.current.activeIndex).toBe(2);
    act(() => {
      result.current.handleKeyDown(makeEvent('ArrowUp'), '/');
    });
    expect(result.current.activeIndex).toBe(1);
  });

  it('selectCommand returns replacement text', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    let replacement = '';
    act(() => {
      replacement = result.current.selectCommand(0);
    });
    expect(replacement).toBe('/help ');
    expect(result.current.open).toBe(false);
  });

  it('selectCommand returns empty for invalid index', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    expect(result.current.selectCommand(-1)).toBe('');
    expect(result.current.selectCommand(99)).toBe('');
  });

  it('updateFromValue filters commands', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    act(() => {
      result.current.updateFromValue('/clear');
    });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe('clear');
  });

  it('filtering is case-insensitive', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    act(() => {
      result.current.updateFromValue('/HELP');
    });
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe('help');
  });

  it('close resets state', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    act(() => {
      result.current.updateFromValue('/clear');
    });
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.activeIndex).toBe(0);
  });

  it('setActiveIndex works', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => result.current.setActiveIndex(2));
    expect(result.current.activeIndex).toBe(2);
  });

  it('Enter returns true when open', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    const handled = result.current.handleKeyDown(makeEvent('Enter'), '/he');
    expect(handled).toBe(true);
  });

  it('Backspace past / closes palette', () => {
    const { result } = renderHook(() => useCommandPalette(commands));
    act(() => {
      result.current.handleKeyDown(makeEvent('/'), '');
    });
    expect(result.current.open).toBe(true);
    act(() => {
      result.current.handleKeyDown(makeEvent('Backspace'), '/');
    });
    expect(result.current.open).toBe(false);
  });
});
