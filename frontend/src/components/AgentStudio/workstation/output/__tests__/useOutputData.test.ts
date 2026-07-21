import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOutputData } from '../useOutputData';
vi.mock('../api', () => {
  let store = [
    { id: 'o1', name: 'JSON格式', content: '以JSON格式输出', category: '格式约束', model: '', status: 'active', version: 'v1.0.0', createdAt: '2024-01-01' },
    { id: 'o2', name: 'Markdown格式', content: '以Markdown输出', category: '格式约束', model: '', status: 'active', version: 'v1.0.0', createdAt: '2024-01-01' },
  ];
  const outputAPI = {
    fetchAll: vi.fn().mockImplementation(() => Promise.resolve([...store])),
    create: vi.fn().mockImplementation((data) => {
      const item = { id: 'new_' + Date.now(), ...data, createdAt: '2024-01-01' };
      store = [...store, item];
      return Promise.resolve(item);
    }),
    update: vi.fn().mockImplementation((_id, data) => {
      store = store.map((i) => (i.id === _id ? { ...i, ...data } : i));
      return Promise.resolve(undefined);
    }),
    remove: vi.fn().mockImplementation((id) => {
      store = store.filter((i) => i.id !== id);
      return Promise.resolve(undefined);
    }),
    clone: vi.fn().mockImplementation((item) => {
      const cloned = { ...item, id: item.id + '_copy' };
      store = [...store, cloned];
      return Promise.resolve(cloned);
    }),
    removeBatch: vi.fn().mockImplementation((ids) => {
      store = store.filter((i) => !ids.has(i.id));
      return Promise.resolve(undefined);
    }),
  };
  return { outputAPI };
});




describe('useOutputData', () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useOutputData());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.filtered.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds an item to the list', async () => {
    const { result } = renderHook(() => useOutputData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    const before = result.current.filtered.length;
    act(() => {
      result.current.addItem({ name: 'Test', content: 'Content', category: '格式约束', model: 'GPT-4o', status: 'active', version: 'v1.0.0' });
    });
    await waitFor(() => expect(result.current.filtered.length).toBe(before + 1));
  });

  it('removes an item from the list', async () => {
    const { result } = renderHook(() => useOutputData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    const id = result.current.filtered[0].id;
    act(() => { result.current.removeItem(id); });
    await waitFor(() => {
      expect(result.current.filtered.find((i) => i.id === id)).toBeUndefined();
    });
  });

  it('copies an item', async () => {
    const { result } = renderHook(() => useOutputData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    const before = result.current.filtered.length;
    const item = result.current.filtered[0];
    act(() => { result.current.copyItem(item); });
    await waitFor(() => expect(result.current.filtered.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useOutputData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    act(() => { result.current.setSearch('代码'); });
    await waitFor(() => {
      expect(result.current.filtered.every((i) => i.name.includes('代码') || i.content.includes('代码'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useOutputData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.error).toBeNull();
    expect(result.current.filtered.length).toBeGreaterThan(0);
  });
});
