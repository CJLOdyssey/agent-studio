import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useToolData } from '../useToolData';
vi.mock('../api', () => {
  const toolAPI = {
    fetchAll: vi.fn().mockResolvedValue([{'id': 't1', 'name': '文件搜索', 'description': '搜索文件', 'category': '内置工具', 'model': '内置', 'status': 'active', 'version': 'v1.0.0', 'endpoint': '', 'parameters': '{"type":"object","properties":{}}', 'createdAt': '2024-01-01'}, {'id': 't2', 'name': '代码执行', 'description': '执行代码', 'category': '内置工具', 'model': '内置', 'status': 'active', 'version': 'v1.0.0', 'endpoint': '', 'parameters': '{"type":"object","properties":{}}', 'createdAt': '2024-01-01'}]),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ id: "new_"+Date.now(), ...data, createdAt: "2024-01-01" })),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn().mockImplementation((item) => Promise.resolve({ ...item, id: item.id+"_copy" })),
    removeBatch: vi.fn().mockResolvedValue(undefined),
  };
  return { toolAPI };
});




describe('useToolData', () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useToolData());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds a tool to the list', async () => {
    const { result } = renderHook(() => useToolData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addTool({ name: 'Test Tool', description: 'Test', category: '内置工具', model: '内置', status: 'active', version: 'v1.0.0', endpoint: '' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a tool from the list', async () => {
    const { result } = renderHook(() => useToolData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removeTool(id); });
    await waitFor(() => { expect(result.current.processed.find((m) => m.id === id)).toBeUndefined(); });
  });

  it('copies a tool item', async () => {
    const { result } = renderHook(() => useToolData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyTool(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useToolData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('文件'); });
    await waitFor(() => {
      expect(result.current.processed.every((m) => m.name.includes('文件') || m.category.includes('文件') || m.description.includes('文件'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useToolData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });
});
