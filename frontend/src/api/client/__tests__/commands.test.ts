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

import { listModels, listCommands, executeCommand } from '../commands';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listModels', () => {
  it('calls GET /models', async () => {
    const mockData = [{ id: 'gpt-4', label: 'GPT-4', provider: 'openai' }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listModels();

    expect(mockApi.get).toHaveBeenCalledWith('/models');
    expect(result).toEqual(mockData);
  });
});

describe('listCommands', () => {
  it('calls GET /commands', async () => {
    const mockData = [{ id: 'cmd1', name: 'Run', description: 'Run a task' }];
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await listCommands();

    expect(mockApi.get).toHaveBeenCalledWith('/commands');
    expect(result).toEqual(mockData);
  });
});

describe('executeCommand', () => {
  it('calls POST /commands/execute with required params', async () => {
    mockApi.post.mockResolvedValue({ data: { success: true, message: 'OK', data: {} } });

    const result = await executeCommand('cmd1', 'session1');

    expect(mockApi.post).toHaveBeenCalledWith('/commands/execute', {
      command_id: 'cmd1',
      session_id: 'session1',
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  it('passes payload when provided', async () => {
    mockApi.post.mockResolvedValue({ data: { success: true, message: 'OK', data: {} } });

    await executeCommand('cmd1', 'session1', { key: 'value' });

    expect(mockApi.post).toHaveBeenCalledWith('/commands/execute', {
      command_id: 'cmd1',
      session_id: 'session1',
      payload: { key: 'value' },
    });
  });
});
