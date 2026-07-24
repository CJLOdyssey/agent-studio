import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useToolManagement } from '../useToolManagement';

const STORE = [
  { id: 't1', name: '文件搜索', description: '搜索文件', category: '内置工具', model: '内置', status: 'active' as const, version: 'v1.0.0', endpoint: '', parameters: '{"type":"object","properties":{}}', createdAt: '2024-01-01' },
  { id: 't2', name: '代码执行', description: '执行代码', category: '内置工具', model: '内置', status: 'active' as const, version: 'v1.0.0', endpoint: '', parameters: '{"type":"object","properties":{}}', createdAt: '2024-01-01' },
];

vi.mock('../api', () => ({
  toolAPI: {
    fetchAll: vi.fn(() => Promise.resolve([...STORE])),
    create: vi.fn((data: Record<string, unknown>) => {
      const item = { id: `new_${Date.now()}`, ...data, createdAt: '2024-01-01' } as typeof STORE[0];
      STORE.push(item);
      return Promise.resolve(item);
    }),
    update: vi.fn(async () => {}),
    remove: vi.fn(async (id: string) => {
      const idx = STORE.findIndex((m) => m.id === id);
      if (idx >= 0) STORE.splice(idx, 1);
    }),
    clone: vi.fn(async (item: typeof STORE[0]) => {
      const copy = { ...item, id: `${item.id}_copy` };
      STORE.push(copy);
      return Promise.resolve(copy);
    }),
    removeBatch: vi.fn(async (ids: Set<string>) => {
      for (const id of ids) {
        const idx = STORE.findIndex((m) => m.id === id);
        if (idx >= 0) STORE.splice(idx, 1);
      }
    }),
  },
}));

describe('useToolManagement', { tags: ['unit'] }, () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useToolManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds a tool to the list', async () => {
    const { result } = renderHook(() => useToolManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addTool({ name: 'Test Tool', description: 'Test', category: '内置工具', model: '内置', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '{}' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a tool from the list', async () => {
    const { result } = renderHook(() => useToolManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removeTool(id); });
    await waitFor(() => { expect(result.current.processed.find((m) => m.id === id)).toBeUndefined(); });
  });

  it('copies a tool item', async () => {
    const { result } = renderHook(() => useToolManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyTool(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useToolManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('__nonexistent__'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setSearch(''); });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useToolManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });
});
