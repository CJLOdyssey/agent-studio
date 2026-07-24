import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockRuns = [{ id: '1', requirement: 'test', status: 'completed', created_at: '2024-01-01' }];

const mockSessions = [{ id: 's1', title: 'Session 1', message_count: 3, updated_at: '2024-01-01' }];

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockAxiosInstance) },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('API hooks', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useRuns fetches and caches run list', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: mockRuns });
    const { useRuns } = await import('../hooks');
    const { result } = renderHook(() => useRuns(20), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRuns);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/runs', { params: { limit: 20 } });
  });

  it('useSessions fetches and caches session list', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: mockSessions });
    const { useSessions } = await import('../hooks');
    const { result } = renderHook(() => useSessions(10), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSessions);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/sessions', { params: { limit: 10 } });
  });

  it('useRun only fetches when id is provided', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: mockRuns[0] });
    const { useRun } = await import('../hooks');

    const { result, rerender } = renderHook((id: string | undefined) => useRun(id), {
      initialProps: undefined as string | undefined,
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(mockAxiosInstance.get).not.toHaveBeenCalled();

    rerender('1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRuns[0]);
  });

  it('useAgents fetches agent list with longer stale time', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 'a1', name: 'Agent 1' }] });
    const { useAgents } = await import('../hooks');
    const { result } = renderHook(() => useAgents(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/agents');
  });

  it('useCommands fetches command list', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 'c1', name: 'Run' }] });
    const { useCommands } = await import('../hooks');
    const { result } = renderHook(() => useCommands(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/commands');
    expect(result.current.data).toEqual([{ id: 'c1', name: 'Run' }]);
  });

  it('useAvailableModels merges models from keys and api models', async () => {
    let callCount = 0;
    mockAxiosInstance.get.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: [{ id: 'gpt-4', label: 'GPT-4', provider: 'openai' }] });
      }
      return Promise.resolve({ data: [{ id: 'k1', provider: 'openai', usage_type: 'chat', label: 'Key', key_masked: 'sk-***', base_url: null, models: ['gpt-3.5'], is_active: true, is_default: false, last_used_at: null, created_at: null }] });
    });
    const { useAvailableModels } = await import('../hooks');
    const { result } = renderHook(() => useAvailableModels(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThanOrEqual(1);
    });

    const models = result.current;
    const ids = models.map(m => m.id);
    expect(ids).toContain('gpt-4');
    expect(ids).toContain('gpt-3.5');
  });
});
