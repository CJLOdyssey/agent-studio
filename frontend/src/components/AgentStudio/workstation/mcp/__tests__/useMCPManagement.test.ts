import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMcpManagement } from '../useMCPManagement';

interface MockEntry {
  id: string;
  name: string;
  description: string;
  type: 'stdio' | 'sse';
  status: 'connected' | 'disconnected' | 'error';
  version: string;
  command: string;
  url: string;
  createdAt: string;
}

const STORE: MockEntry[] = [
  { id: 'm1', name: '文件系统MCP', description: '文件系统访问', type: 'stdio', status: 'connected', version: 'v1.0.0', command: 'node', url: '', createdAt: '2024-01-01' },
  { id: 'm2', name: '数据库MCP', description: '数据库查询', type: 'sse', status: 'disconnected', version: 'v1.0.0', command: 'python', url: 'http://localhost:8080', createdAt: '2024-01-01' },
];

vi.mock('../api', () => ({
  mcpAPI: {
    fetchAll: vi.fn(() => Promise.resolve([...STORE])),
    create: vi.fn((data: Record<string, unknown>) => {
      const item = { id: `new_${Date.now()}`, ...data, createdAt: '2024-01-01' } as MockEntry;
      STORE.push(item);
      return Promise.resolve(item);
    }),
    update: vi.fn(async () => {}),
    remove: vi.fn(async (id: string) => {
      const idx = STORE.findIndex((m) => m.id === id);
      if (idx >= 0) STORE.splice(idx, 1);
    }),
    clone: vi.fn(async (item: MockEntry) => {
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

describe('useMcpManagement', { tags: ['unit'] }, () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useMcpManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds an MCP to the list', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addMCP({ name: 'Test MCP', description: 'Test', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: 'test', url: '' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes an MCP from the list', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removeMCP(id); });
    await waitFor(() => expect(result.current.processed.find((m) => m.id === id)).toBeUndefined());
  });

  it('copies an MCP item', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyMCP(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('handles search', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('__nonexistent__'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setSearch(''); });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('handles status filter', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setStatusFilter('connected'); });
    expect(result.current.processed.every((m) => m.status === 'connected')).toBe(true);
    act(() => { result.current.setStatusFilter('all'); });
  });

  it('handles selection', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(true);
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(false);
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useMcpManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });
});
