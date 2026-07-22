import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../instance', () => ({ default: mockClient }));

import {
  fetchDashboardStats,
  fetchCommandLogs,
  fetchRecentActivity,
  fetchSystemHealth,
} from '../admin';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchDashboardStats', () => {
  it('calls GET /admin/stats and returns data', async () => {
    const mockStats = {
      agents: 5,
      prompts: 10,
      tools: 3,
      mcps: 2,
      skills: 4,
      teams: 1,
      logs_today: 100,
      updated_at: '2024-01-01T00:00:00Z',
    };
    mockClient.get.mockResolvedValue({ data: mockStats });

    const result = await fetchDashboardStats();

    expect(mockClient.get).toHaveBeenCalledWith('/admin/stats');
    expect(result).toEqual(mockStats);
  });
});

describe('fetchCommandLogs', () => {
  it('calls GET /admin/logs with default params', async () => {
    const mockLogs = [{ id: '1', timestamp: '2024-01-01', command: 'test', payload: '{}', result: 'ok' }];
    mockClient.get.mockResolvedValue({ data: mockLogs });

    const result = await fetchCommandLogs();

    expect(mockClient.get).toHaveBeenCalledWith('/admin/logs', { params: { limit: 50, offset: 0 } });
    expect(result).toEqual(mockLogs);
  });

  it('passes custom limit and offset', async () => {
    mockClient.get.mockResolvedValue({ data: [] });

    await fetchCommandLogs(10, 20);

    expect(mockClient.get).toHaveBeenCalledWith('/admin/logs', { params: { limit: 10, offset: 20 } });
  });
});

describe('fetchRecentActivity', () => {
  it('calls GET /admin/activity with default limit', async () => {
    const mockActivity = [{ id: '1', action: 'create', entity_type: 'agent', entity_name: 'Test Agent', detail: 'Created', timestamp: '2024-01-01' }];
    mockClient.get.mockResolvedValue({ data: mockActivity });

    const result = await fetchRecentActivity();

    expect(mockClient.get).toHaveBeenCalledWith('/admin/activity', { params: { limit: 10 } });
    expect(result).toEqual(mockActivity);
  });

  it('passes custom limit', async () => {
    mockClient.get.mockResolvedValue({ data: [] });

    await fetchRecentActivity(5);

    expect(mockClient.get).toHaveBeenCalledWith('/admin/activity', { params: { limit: 5 } });
  });
});

describe('fetchSystemHealth', () => {
  it('calls GET /health and returns data', async () => {
    const mockHealth = { status: 'healthy', database: 'connected', redis: 'connected' };
    mockClient.get.mockResolvedValue({ data: mockHealth });

    const result = await fetchSystemHealth();

    expect(mockClient.get).toHaveBeenCalledWith('/health');
    expect(result).toEqual(mockHealth);
  });
});
