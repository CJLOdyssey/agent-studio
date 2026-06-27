import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMCPData } from '../useMCPData';

describe('useMCPData', () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useMCPData());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds an MCP to the list', async () => {
    const { result } = renderHook(() => useMCPData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addMCP({ name: 'Test MCP', description: 'Test', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: 'test', url: '' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes an MCP from the list', async () => {
    const { result } = renderHook(() => useMCPData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removeMCP(id); });
    await waitFor(() => { expect(result.current.processed.find((m) => m.id === id)).toBeUndefined(); });
  });

  it('copies an MCP item', async () => {
    const { result } = renderHook(() => useMCPData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyMCP(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useMCPData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('文件'); });
    await waitFor(() => {
      expect(result.current.processed.every((m) => m.name.includes('文件') || m.description.includes('文件'))).toBe(true);
    });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useMCPData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.error).toBeNull();
    expect(result.current.processed.length).toBeGreaterThan(0);
  });
});
