import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useItemList } from '../../../../../hooks/useItemList';

interface TestItem {
  id: string;
  enabled: boolean;
  name: string;
}

function makeItem(id: string, enabled = false): TestItem {
  return { id, enabled, name: `Item ${id}` };
}

describe('useItemList', () => {
  it('initializes with empty items', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    expect(result.current.items).toEqual([]);
  });

  it('toggle switches enabled state', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    act(() => result.current.setItems([makeItem('1', false)]));
    act(() => result.current.toggle('1'));
    expect(result.current.items[0].enabled).toBe(true);
    act(() => result.current.toggle('1'));
    expect(result.current.items[0].enabled).toBe(false);
  });

  it('addCustom adds new item and sets editingId', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    act(() => result.current.addCustom(() => makeItem('new')));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('new');
    expect(result.current.editingId).toBe('new');
  });

  it('update modifies item by id', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    act(() => result.current.setItems([makeItem('1')]));
    act(() => result.current.update('1', { name: 'Updated' } as Partial<TestItem>));
    expect(result.current.items[0].name).toBe('Updated');
  });

  it('remove deletes item and clears editingId', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    act(() => result.current.setItems([makeItem('1'), makeItem('2')]));
    act(() => result.current.setEditingId('1'));
    act(() => result.current.remove('1'));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('2');
    expect(result.current.editingId).toBeNull();
  });

  it('setItems replaces entire list', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    act(() => result.current.setItems([makeItem('a'), makeItem('b')]));
    expect(result.current.items).toHaveLength(2);
    act(() => result.current.setItems([makeItem('c')]));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe('c');
  });

  it('getEnabledCount returns correct count', () => {
    const { result } = renderHook(() => useItemList<TestItem>([]));
    act(() => result.current.setItems([makeItem('1', true), makeItem('2', false), makeItem('3', true)]));
    expect(result.current.getEnabledCount()).toBe(2);
  });
});
