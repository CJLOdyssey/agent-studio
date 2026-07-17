import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const mockAxiosInstance = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockAxiosInstance) },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDeleteAgent', () => {
  it('calls deleteAgent and invalidates agents', async () => {
    mockAxiosInstance.delete.mockResolvedValue({});
    const { useDeleteAgent } = await import('../hooks');
    const { result } = renderHook(() => useDeleteAgent(), { wrapper: createWrapper() });

    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/agents/a1');
  });
});

describe('useToggleAgent', () => {
  it('calls toggleAgent and invalidates agents', async () => {
    mockAxiosInstance.put.mockResolvedValue({ data: { id: 'a1', is_active: false } });
    const { useToggleAgent } = await import('../hooks');
    const { result } = renderHook(() => useToggleAgent(), { wrapper: createWrapper() });

    result.current.mutate('a1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.put).toHaveBeenCalledWith('/agents/a1/toggle');
  });
});

describe('useCreateAgent', () => {
  it('calls createAgent and invalidates agents', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: { id: 'new' } });
    const { useCreateAgent } = await import('../hooks');
    const { result } = renderHook(() => useCreateAgent(), { wrapper: createWrapper() });

    const cfg = { name: 'Agent', role_identifier: 'dev', system_prompt: 'Hello', order: 1, is_active: true, is_approver: false, icon: 'bot' };
    result.current.mutate(cfg);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/agents', cfg);
  });
});

describe('useUpdateAgent', () => {
  it('calls updateAgent and invalidates agents', async () => {
    mockAxiosInstance.put.mockResolvedValue({});
    const { useUpdateAgent } = await import('../hooks');
    const { result } = renderHook(() => useUpdateAgent(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'a1', name: 'Updated' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.put).toHaveBeenCalledWith('/agents/a1', { name: 'Updated' });
  });
});

describe('useCreateSession', () => {
  it('calls createSession', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: { id: 's1', title: 'Chat' } });
    const { useCreateSession } = await import('../hooks');
    const { result } = renderHook(() => useCreateSession(), { wrapper: createWrapper() });

    result.current.mutate({ title: 'Chat' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/sessions', { title: 'Chat' });
  });
});

describe('useDeleteSession', () => {
  it('calls deleteSession', async () => {
    mockAxiosInstance.delete.mockResolvedValue({});
    const { useDeleteSession } = await import('../hooks');
    const { result } = renderHook(() => useDeleteSession(), { wrapper: createWrapper() });

    result.current.mutate('s1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/sessions/s1');
  });
});

describe('useSessionDetail', () => {
  it('fetches session detail', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: { id: 's1', title: 'Chat' } });
    const { useSessionDetail } = await import('../hooks');
    const { result } = renderHook(() => useSessionDetail('s1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: 's1', title: 'Chat' });
  });
});
