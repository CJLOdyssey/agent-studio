import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentManagement } from '../useAgentManagement';

vi.mock('../api', () => {
  const mockItems: Array<Record<string, string | string[]>> = [
    { id: '1', name: '前端开发 Agent', description: '前端开发', team: '前端团队', model: 'Claude Sonnet 4', status: 'running', version: 'v2.1.0', systemPromptId: 'p1', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-10' },
    { id: '2', name: '后端开发 Agent', description: '后端开发', team: '后端团队', model: 'GPT-4o', status: 'stopped', version: 'v1.8.3', systemPromptId: 'p2', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-12' },
    { id: '3', name: '测试 Agent', description: '自动化测试', team: '质量团队', model: 'Gemini 2.5 Pro', status: 'stopped', version: 'v1.5.0', systemPromptId: 'p3', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-20' },
  ];
  let counter = 99;
  return {
    agentAPI: {
      fetchAll: () => Promise.resolve([...mockItems] as unknown as import('../agent.types').AgentEntry[]),
      create: (data: Record<string, unknown>) => {
        const created = { ...data, id: String(++counter), createdAt: new Date().toISOString().slice(0, 10) } as Record<string, unknown>;
        mockItems.push(created);
        return Promise.resolve(created);
      },
      update: (_id: string, _data: Record<string, unknown>) => Promise.resolve(),
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
        for (let i = mockItems.length - 1; i >= 0; i--) { if (ids.has(mockItems[i].id as string)) mockItems.splice(i, 1); }
        return Promise.resolve();
      },
    },
  };
});

describe('useAgentManagement', () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useAgentManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds an agent to the list', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData({ name: 'Test Agent', description: '', team: '前端团队', model: 'GPT-4o', status: 'stopped', version: 'v1.0.0', systemPromptId: 'agent-prompt-1', toolIds: [], mcpIds: [], skillIds: [] }); });
    await waitFor(() => { expect(result.current.formData.name).toBe('Test Agent'); });
    act(() => { result.current.handleSave(); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a non-running agent', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const stopped = result.current.processed.find((a) => a.status === 'stopped');
    if (!stopped) return;
    act(() => { result.current.openDelete(stopped); });
    act(() => { result.current.handleDelete(); });
    await waitFor(() => { expect(result.current.processed.find((a) => a.id === stopped.id)).toBeUndefined(); });
  });

  it('copies an agent', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.handleCopy(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('前端'); });
    await waitFor(() => {
      expect(result.current.processed.every((a) => a.name.includes('前端') || a.team.includes('前端') || a.model.includes('前端'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
  });
});
