import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentManagement } from '../useAgentManagement';

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
