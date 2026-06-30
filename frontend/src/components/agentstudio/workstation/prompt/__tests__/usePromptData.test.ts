import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptData } from '../usePromptData';
vi.mock('../api', () => {
  const promptAPI = {
    fetchAll: vi.fn().mockResolvedValue([{'id': 'p1', 'name': '系统提示', 'content': '你是一个助手', 'category': '系统提示词', 'model': '', 'status': 'active', 'version': 'v1.0.0', 'createdAt': '2024-01-01'}, {'id': 'p2', 'name': '用户提示', 'content': '请帮助我', 'category': '用户提示词', 'model': '', 'status': 'active', 'version': 'v1.0.0', 'createdAt': '2024-01-01'}, {'id': 'p3', 'name': '代码审查', 'content': '审查代码质量', 'category': '任务模板', 'model': '', 'status': 'active', 'version': 'v1.0.0', 'createdAt': '2024-01-01'}]),
    create: vi.fn().mockImplementation((data) => Promise.resolve({ id: "new_"+Date.now(), ...data, createdAt: "2024-01-01" })),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    clone: vi.fn().mockImplementation((item) => Promise.resolve({ ...item, id: item.id+"_copy" })),
    removeBatch: vi.fn().mockResolvedValue(undefined),
  };
  return { promptAPI };
});




describe('usePromptData', () => {
  it('starts loading and loads on mount', async () => {
    const { result } = renderHook(() => usePromptData());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('adds a prompt to the list', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    const before = result.current.processed.length;
    act(() => {
      result.current.addPrompt({ name: 'Test', content: 'Content', category: '系统提示词', model: 'GPT-4o', status: 'active', version: 'v1.0.0' });
    });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a prompt from the list', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.error).toBeNull();

    const id = result.current.processed[0].id;
    act(() => { result.current.removePrompt(id); });
    await waitFor(() => {
      expect(result.current.processed.find((p) => p.id === id)).toBeUndefined();
    });
  });

  it('copies a prompt', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    const before = result.current.processed.length;
    const item = result.current.processed[0];
    act(() => { result.current.copyPrompt(item); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    act(() => { result.current.setSearch('代码审查'); });
    await waitFor(() => {
      expect(result.current.processed.length).toBeGreaterThan(0);
      expect(result.current.processed.every((p) => p.name.includes('代码审查') || p.content.includes('代码审查'))).toBe(true);
    });
  });

  it('sorts by name', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    act(() => { result.current.handleSort('name'); });
    await waitFor(() => {
      expect(result.current.sortField).toBe('name');
    });
    const names = result.current.processed.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('bulk removes prompts', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    const ids = new Set([result.current.processed[0].id, result.current.processed[1].id]);
    act(() => { result.current.removeMultiple(ids); });
    await waitFor(() => {
      expect(result.current.processed.find((p) => ids.has(p.id))).toBeUndefined();
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });
});
