import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTeamData } from '../useTeamData';

vi.mock('../api', () => {
  const mockItems: Array<Record<string, string>> = [
    { id: 't1', name: '前端开发团队', description: '负责前端开发', status: 'active', createdAt: '2026-03-10' },
    { id: 't2', name: '后端开发团队', description: '负责后端开发', status: 'active', createdAt: '2026-03-12' },
    { id: 't3', name: '测试团队', description: '负责测试', status: 'active', createdAt: '2026-03-15' },
    { id: 't4', name: '运维团队', description: '负责运维', status: 'inactive', createdAt: '2026-03-20' },
  ];
  let counter = 99;
  return {
    teamAPI: {
      fetchAll: () => Promise.resolve([...mockItems] as unknown as import('../team.types').TeamEntry[]),
      create: (data: Record<string, unknown>) => {
        const created = { ...data, id: String(++counter), createdAt: new Date().toISOString().slice(0, 10) } as Record<string, string>;
        mockItems.push(created);
        return Promise.resolve(created);
      },
      update: () => Promise.resolve(),
      remove: (id: string) => {
        const idx = mockItems.findIndex((m) => m.id === id);
        if (idx >= 0) mockItems.splice(idx, 1);
        return Promise.resolve();
      },
      clone: (item: Record<string, unknown>) => {
        const cloned = { ...item, id: String(++counter), name: `${String(item.name).slice(0, 28)} (副本)`, createdAt: new Date().toISOString().slice(0, 10) };
        mockItems.push(cloned);
        return Promise.resolve(cloned);
      },
      removeBatch: (ids: Set<string>) => {
        for (let i = mockItems.length - 1; i >= 0; i--) { if (ids.has(mockItems[i].id)) mockItems.splice(i, 1); }
        return Promise.resolve();
      },
    },
  };
});

describe('useTeamData', () => {
  it('starts loading and loads teams on mount', async () => {
    const { result } = renderHook(() => useTeamData());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds a team to the list', async () => {
    const { result } = renderHook(() => useTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addTeam({ name: 'Test Team', description: 'Test', status: 'active' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a team', async () => {
    const { result } = renderHook(() => useTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.deleteTeam(id); });
    await waitFor(() => { expect(result.current.processed.find((t) => t.id === id)).toBeUndefined(); });
  });

  it('copies a team', async () => {
    const { result } = renderHook(() => useTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyTeam(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('前端'); });
    await waitFor(() => {
      expect(result.current.processed.every((t) => t.name.includes('前端') || t.description.includes('前端'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });
});
