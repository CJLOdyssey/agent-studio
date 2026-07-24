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

import { fetchWorkflow, saveWorkflow, deleteWorkflow, listWorkflows } from '../workflows';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchWorkflow', { tags: ['unit'] }, () => {
  it('calls GET /workflows/teams/:id and returns data', async () => {
    const mockData = { id: 'w1', teamId: 't1', team_id: 't1', name: 'test', maxRounds: 10, nodes: [], edges: [] };
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await fetchWorkflow('t1');

    expect(mockApi.get).toHaveBeenCalledWith('/workflows/teams/t1');
    expect(result).toEqual(mockData);
  });

  it('returns null on 404', async () => {
    const err = { response: { status: 404 } };
    mockApi.get.mockRejectedValue(err);

    const result = await fetchWorkflow('t1');

    expect(result).toBeNull();
  });

  it('re-throws non-404 errors', async () => {
    const err = { response: { status: 500 } };
    mockApi.get.mockRejectedValue(err);

    await expect(fetchWorkflow('t1')).rejects.toEqual(err);
  });
});

describe('saveWorkflow', { tags: ['unit'] }, () => {
  it('calls POST /workflows with config', async () => {
    const config = { teamId: 't1', team_id: 't1', name: 'test', maxRounds: 10, nodes: [], edges: [] };
    const mockData = { id: 'w1', teamId: 't1', team_id: 't1', name: 'test', maxRounds: 10, nodes: [], edges: [] };
    mockApi.post.mockResolvedValue({ data: mockData });

    const result = await saveWorkflow(config);

    expect(mockApi.post).toHaveBeenCalledWith('/workflows', config);
    expect(result).toEqual(mockData);
  });
});

describe('deleteWorkflow', { tags: ['unit'] }, () => {
  it('calls DELETE /workflows/:id', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteWorkflow('w1');

    expect(mockApi.delete).toHaveBeenCalledWith('/workflows/w1');
  });
});

describe('listWorkflows', { tags: ['unit'] }, () => {
  it('calls GET /workflows', async () => {
    const mockData = [{ id: 'w1', teamId: 't1', team_id: 't1', name: 'test', maxRounds: 10, nodes: [], edges: [] }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listWorkflows();

    expect(mockApi.get).toHaveBeenCalledWith('/workflows');
    expect(result).toEqual(mockData);
  });
});
