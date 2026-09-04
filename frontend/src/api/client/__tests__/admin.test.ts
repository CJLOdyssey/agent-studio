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

describe('fetchDashboardStats', { tags: ['unit'] }, () => {
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

describe('fetchCommandLogs', { tags: ['unit'] }, () => {
  it('calls GET /admin/logs with default params and returns paginated response', async () => {
    const mockResponse = {
      items: [{ id: '1', timestamp: '2024-01-01', action: 'test', entity_type: 'agent', entity_name: 'a', detail: 'ok', level: 'info', before: '', after: '', user: 'admin', ip: '1.1.1.1', user_agent: '', request_id: '' }],
      total: 1,
      offset: 0,
      limit: 50,
    };
    mockClient.get.mockResolvedValue({ data: mockResponse });

    const result = await fetchCommandLogs({ limit: 50, offset: 0 });

    expect(mockClient.get).toHaveBeenCalledWith('/admin/logs', { params: { limit: 50, offset: 0 } });
    expect(result).toEqual(mockResponse);
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('passes custom limit, offset, search, level and entity_type', async () => {
    mockClient.get.mockResolvedValue({ data: { items: [], total: 0, offset: 20, limit: 10 } });

    await fetchCommandLogs({ limit: 10, offset: 20, search: 'foo', level: 'error', entity_type: 'agent' });

    expect(mockClient.get).toHaveBeenCalledWith('/admin/logs', {
      params: { limit: 10, offset: 20, search: 'foo', level: 'error', entity_type: 'agent' },
    });
  });
});

describe('fetchRecentActivity', { tags: ['unit'] }, () => {
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

describe('fetchSystemHealth', { tags: ['unit'] }, () => {
  it('calls GET /health and returns backend health shape', async () => {
    const mockHealth = { status: 'healthy', checks: { database: 'ok', redis: 'ok' } };
    mockClient.get.mockResolvedValue({ data: mockHealth });

    const result = await fetchSystemHealth();

    expect(mockClient.get).toHaveBeenCalledWith('/health', { validateStatus: expect.any(Function) });
    expect(result).toEqual(mockHealth);
  });

  it('accepts degraded health responses with 503 status', async () => {
    const degradedHealth = { status: 'degraded', checks: { database: 'down', redis: 'ok' } };
    mockClient.get.mockResolvedValue({ status: 503, data: degradedHealth });

    const result = await fetchSystemHealth();

    expect(result).toEqual(degradedHealth);
  });
});
