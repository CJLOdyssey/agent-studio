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

import { listSkills, createSkill, updateSkill, deleteSkill } from '../skills';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listSkills', () => {
  it('calls GET /skills', async () => {
    const mockData = [{
      id: '1', name: 'skill1', description: 'desc', category: 'cat', version: '1.0',
      status: 'active', author: 'author', instructions: 'do x', prompt_id: null,
      tool_names: [], output_constraint: '', created_at: '2024-01-01',
    }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listSkills();

    expect(mockApi.get).toHaveBeenCalledWith('/skills');
    expect(result).toEqual(mockData);
  });
});

describe('createSkill', () => {
  it('calls POST /skills with payload', async () => {
    const payload = { name: 'skill1', description: 'desc', category: 'cat' };
    const mockData = {
      id: '1', name: 'skill1', description: 'desc', category: 'cat', version: '1.0',
      status: 'active', author: '', instructions: '', prompt_id: null,
      tool_names: [], output_constraint: '', created_at: '2024-01-01',
    };
    mockApi.post.mockResolvedValue({ data: mockData });

    const result = await createSkill(payload);

    expect(mockApi.post).toHaveBeenCalledWith('/skills', payload);
    expect(result).toEqual(mockData);
  });
});

describe('updateSkill', () => {
  it('calls PUT /skills/:id with payload', async () => {
    const mockData = {
      id: '1', name: 'updated', description: 'desc', category: 'cat', version: '1.0',
      status: 'active', author: '', instructions: '', prompt_id: null,
      tool_names: [], output_constraint: '', created_at: '2024-01-01',
    };
    mockApi.put.mockResolvedValue({ data: mockData });

    const result = await updateSkill('1', { name: 'updated' });

    expect(mockApi.put).toHaveBeenCalledWith('/skills/1', { name: 'updated' });
    expect(result).toEqual(mockData);
  });
});

describe('deleteSkill', () => {
  it('calls DELETE /skills/:id', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteSkill('1');

    expect(mockApi.delete).toHaveBeenCalledWith('/skills/1');
  });
});
