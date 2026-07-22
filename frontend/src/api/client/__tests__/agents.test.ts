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

import { listAgents, createAgent, updateAgent, deleteAgent, toggleAgent } from '../agents';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listAgents', () => {
  it('calls GET /agents', async () => {
    const mockData = [{ id: 'a1', name: 'Agent 1', role_identifier: 'dev', system_prompt: 'You are...' }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listAgents();

    expect(mockApi.get).toHaveBeenCalledWith('/agents');
    expect(result).toEqual(mockData);
  });
});

describe('createAgent', () => {
  it('calls POST /agents with config', async () => {
    const cfg = {
      name: 'Agent', role_identifier: 'dev', system_prompt: 'Hello', order: 1,
      is_active: true, is_approver: false, icon: 'bot',
    };
    mockApi.post.mockResolvedValue({ data: { id: 'a1' } });

    const result = await createAgent(cfg);

    expect(mockApi.post).toHaveBeenCalledWith('/agents', cfg);
    expect(result).toEqual({ id: 'a1' });
  });
});

describe('updateAgent', () => {
  it('calls PUT /agents/:id with config', async () => {
    mockApi.put.mockResolvedValue({});

    await updateAgent('a1', { name: 'Updated' });

    expect(mockApi.put).toHaveBeenCalledWith('/agents/a1', { name: 'Updated' });
  });
});

describe('deleteAgent', () => {
  it('calls DELETE /agents/:id', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteAgent('a1');

    expect(mockApi.delete).toHaveBeenCalledWith('/agents/a1');
  });
});

describe('toggleAgent', () => {
  it('calls PUT /agents/:id/toggle', async () => {
    mockApi.put.mockResolvedValue({ data: { id: 'a1', is_active: false } });

    const result = await toggleAgent('a1');

    expect(mockApi.put).toHaveBeenCalledWith('/agents/a1/toggle');
    expect(result).toEqual({ id: 'a1', is_active: false });
  });
});
