import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSkillData } from '../useSkillData';

describe('useSkillData', () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useSkillData());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds a skill to the list', async () => {
    const { result } = renderHook(() => useSkillData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addSkill({ name: 'Test Skill', description: 'Test', category: '前端开发', status: 'installed', version: 'v1.0.0', author: 'me' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a skill from the list', async () => {
    const { result } = renderHook(() => useSkillData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removeSkill(id); });
    await waitFor(() => { expect(result.current.processed.find((m) => m.id === id)).toBeUndefined(); });
  });

  it('copies a skill item', async () => {
    const { result } = renderHook(() => useSkillData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copySkill(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useSkillData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('React'); });
    await waitFor(() => {
      expect(result.current.processed.every((m) => m.name.includes('React') || m.category.includes('React') || m.description.includes('React'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useSkillData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
  });
});
