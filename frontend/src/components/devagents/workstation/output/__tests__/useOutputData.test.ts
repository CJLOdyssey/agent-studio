import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOutputData } from '../useOutputData';
vi.mock('../api', () => {
  const outputAPI = {
    fetchAll: vi.fn().mockResolvedValue([{'id': 'o1', 'name': 'JSON格式', 'content': '以JSON格式输出', 'category': '格式约束', 'model': '', 'status': 'active', 'version': 'v1.0.0', 'createdAt': '2024-01-01'}, {'id': 'o2', 'name': 'Markdown格式', 'content': '以Markdown输出', 'category': '格式约束', 'model': '', 'status': 'active', 'version': 'v1.0.0', 'createdAt': '2024-01-01'}]),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ id: "new_"+Date.now(), ...data, createdAt: "2024-01-01" })),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn().mockImplementation((item) => Promise.resolve({ ...item, id: item.id+"_copy" })),
    removeBatch: vi.fn().mockResolvedValue(undefined),
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
