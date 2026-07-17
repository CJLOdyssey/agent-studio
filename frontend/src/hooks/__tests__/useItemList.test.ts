import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useItemList } from '../useItemList';

interface TestItem {
  id: string;
  enabled: boolean;
  name?: string;
}

const presets: TestItem[] = [
  { id: 'preset-1', enabled: false, name: 'Preset 1' },
  { id: 'preset-2', enabled: false, name: 'Preset 2' },
];

describe('useItemList', () => {
  it('initializes with empty items', () => {
    const { result } = renderHook(() => useItemList(presets));
    expect(result.current.items).toEqual([]);
  });

  it('toggles preset item from disabled to enabled', () => {
    const { result } = renderHook(() => useItemList(presets));

    act(() => result.current.toggle('preset-1'));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('preset-1');
    expect(result.current.items[0].enabled).toBe(true);
  });

  it('toggles item from enabled to disabled', () => {
    const { result } = renderHook(() => useItemList(presets));

    act(() => result.current.toggle('preset-1'));
    act(() => result.current.toggle('preset-1'));

    expect(result.current.items[0].enabled).toBe(false);
  });

  it('adds custom item', () => {
    const { result } = renderHook(() => useItemList(presets));

    act(() => {
      result.current.addCustom(() => ({ id: 'custom-1', enabled: true, name: 'Custom' }));
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('custom-1');
    expect(result.current.editingId).toBe('custom-1');
  });

  it('updates item', () => {
    const { result } = renderHook(() => useItemList(presets));

    act(() => result.current.toggle('preset-1'));
    act(() => result.current.update('preset-1', { name: 'Updated' }));

    expect(result.current.items[0].name).toBe('Updated');
  });

  it('removes item and clears editingId', () => {
    const { result } = renderHook(() => useItemList(presets));

    act(() => {
      result.current.addCustom(() => ({ id: 'custom-1', enabled: true }));
    });
    act(() => result.current.remove('custom-1'));

    expect(result.current.items).toHaveLength(0);
    expect(result.current.editingId).toBeNull();
  });

  it('getEnabledCount returns count of enabled items', () => {
    const { result } = renderHook(() => useItemList(presets));

    act(() => result.current.toggle('preset-1'));
    act(() => result.current.toggle('preset-2'));

    expect(result.current.getEnabledCount()).toBe(2);

    act(() => result.current.toggle('preset-1'));
    expect(result.current.getEnabledCount()).toBe(1);
  });

  it('toggle does nothing for non-existent id without preset', () => {
    const { result } = renderHook(() => useItemList([]));

    act(() => result.current.toggle('nonexistent'));

    expect(result.current.items).toEqual([]);
  });
});
