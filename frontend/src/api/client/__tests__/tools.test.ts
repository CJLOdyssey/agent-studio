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

import {
  listTools,
  createTool,
  updateTool,
  deleteTool,
  validateTool,
  executeTool,
} from '../tools';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listTools', () => {
  it('calls GET /tools', async () => {
    const mockData = [{ id: '1', name: 'tool1', description: 'desc', category: 'cat', model: null, status: 'active', version: '1.0', endpoint: '/api/test', created_at: '2024-01-01' }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listTools();

    expect(mockApi.get).toHaveBeenCalledWith('/tools');
    expect(result).toEqual(mockData);
  });
});

describe('createTool', () => {
  it('calls POST /tools with payload', async () => {
    const payload = { name: 'tool1', description: 'desc', category: 'cat' };
    const mockData = { id: '1', name: 'tool1', description: 'desc', category: 'cat', model: null, status: 'active', version: '1.0', endpoint: '/test', created_at: '2024-01-01' };
    mockApi.post.mockResolvedValue({ data: mockData });

    const result = await createTool(payload);

    expect(mockApi.post).toHaveBeenCalledWith('/tools', payload);
    expect(result).toEqual(mockData);
  });
});

describe('updateTool', () => {
  it('calls PUT /tools/:id with payload', async () => {
    const mockData = { id: '1', name: 'updated', description: 'desc', category: 'cat', model: null, status: 'active', version: '1.0', endpoint: '/test', created_at: '2024-01-01' };
    mockApi.put.mockResolvedValue({ data: mockData });

    const result = await updateTool('1', { name: 'updated' });

    expect(mockApi.put).toHaveBeenCalledWith('/tools/1', { name: 'updated' });
    expect(result).toEqual(mockData);
  });
});

describe('deleteTool', () => {
  it('calls DELETE /tools/:id', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteTool('1');

    expect(mockApi.delete).toHaveBeenCalledWith('/tools/1');
  });
});

describe('validateTool', () => {
  it('calls POST /tools/validate', async () => {
    const mockData = { is_valid: true, suggestions: [] };
    mockApi.post.mockResolvedValue({ data: mockData });

    const result = await validateTool('print("hello")', 'python');

    expect(mockApi.post).toHaveBeenCalledWith('/tools/validate', { code: 'print("hello")', language: 'python' });
    expect(result).toEqual(mockData);
  });

  it('defaults language to python', async () => {
    mockApi.post.mockResolvedValue({ data: { is_valid: true, suggestions: [] } });

    await validateTool('code');

    expect(mockApi.post).toHaveBeenCalledWith('/tools/validate', { code: 'code', language: 'python' });
  });
});

describe('executeTool', () => {
  it('calls POST /tools/execute', async () => {
    const mockData = { success: true, output: 'hello' };
    mockApi.post.mockResolvedValue({ data: mockData });

    const result = await executeTool('print("hello")', 'python');

    expect(mockApi.post).toHaveBeenCalledWith('/tools/execute', { code: 'print("hello")', language: 'python' });
    expect(result).toEqual(mockData);
  });

  it('defaults language to python', async () => {
    mockApi.post.mockResolvedValue({ data: { success: true } });

    await executeTool('code');

    expect(mockApi.post).toHaveBeenCalledWith('/tools/execute', { code: 'code', language: 'python' });
  });
});
