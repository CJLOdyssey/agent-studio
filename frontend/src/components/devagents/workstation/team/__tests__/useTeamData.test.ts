import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTeamData } from '../useTeamData';

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
    act(() => { result.current.addTeam({ name: 'Test Team', description: 'Test', leader: 'tester', memberCount: 5, status: 'active' }); });
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
      expect(result.current.processed.every((t) => t.name.includes('前端') || t.leader.includes('前端') || t.description.includes('前端'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useTeamData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
  });
});
