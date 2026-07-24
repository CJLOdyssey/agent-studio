import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../instance', () => ({ default: mockApi }));

import { listMCPs, createMCP, updateMCP, deleteMCP } from '../mcps';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listMCPs', { tags: ['unit'] }, () => {
  it('calls GET /mcps', async () => {
    const mockData = [{ id: '1', name: 'mcp1', type: 'stdio', endpoint: '/api/mcp', config: null, status: 'active', created_at: '2024-01-01' }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listMCPs();

    expect(mockApi.get).toHaveBeenCalledWith('/mcps');
    expect(result).toEqual(mockData);
  });
});

describe('createMCP', { tags: ['unit'] }, () => {
  it('calls POST /mcps with payload', async () => {
    const payload = { name: 'mcp1', type: 'stdio' };
    const mockData = { id: '1', name: 'mcp1', type: 'stdio', endpoint: '/api/mcp', config: null, status: 'active', created_at: '2024-01-01' };
    mockApi.post.mockResolvedValue({ data: mockData });

    const result = await createMCP(payload);

    expect(mockApi.post).toHaveBeenCalledWith('/mcps', payload);
    expect(result).toEqual(mockData);
  });
});

describe('updateMCP', { tags: ['unit'] }, () => {
  it('calls PUT /mcps/:id with payload', async () => {
    const mockData = { id: '1', name: 'updated', type: 'stdio', endpoint: '/api/mcp', config: null, status: 'active', created_at: '2024-01-01' };
    mockApi.put.mockResolvedValue({ data: mockData });

    const result = await updateMCP('1', { name: 'updated' });

    expect(mockApi.put).toHaveBeenCalledWith('/mcps/1', { name: 'updated' });
    expect(result).toEqual(mockData);
  });
});

describe('deleteMCP', { tags: ['unit'] }, () => {
  it('calls DELETE /mcps/:id', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteMCP('1');

    expect(mockApi.delete).toHaveBeenCalledWith('/mcps/1');
  });
});
