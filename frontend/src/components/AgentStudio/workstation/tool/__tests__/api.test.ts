import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolEntry, ToolFormData } from '../tool.types';

const mockListTools = vi.fn();
const mockCreateTool = vi.fn();
const mockUpdateTool = vi.fn();
const mockDeleteTool = vi.fn();

vi.mock('../../../../../api/client/tools', () => ({
  listTools: mockListTools,
  createTool: mockCreateTool,
  updateTool: mockUpdateTool,
  deleteTool: mockDeleteTool,
}));

describe('tool api', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const sampleRow = {
    id: 't1',
    name: 'Tool 1',
    description: 'A tool',
    category: 'utility',
    status: 'active',
    version: 'v1',
    endpoint: 'https://example.com',
    method: 'POST',
    headers: '{"Authorization":"Bearer xyz"}',
    parameters: '{"type":"object"}',
    created_at: '2024-01-15T00:00:00Z',
  };

  it('fetchAll returns mapped entries', async () => {
    mockListTools.mockResolvedValue([sampleRow]);

    const { toolAPI } = await import('../api');
    const result = await toolAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Tool 1');
    expect(result[0].status).toBe('active');
  });

  it('toEntry maps method and headers', async () => {
    mockListTools.mockResolvedValue([sampleRow]);

    const { toolAPI } = await import('../api');
    const result = await toolAPI.fetchAll();

    expect(result[0].method).toBe('POST');
    expect(result[0].headers).toBe('{"Authorization":"Bearer xyz"}');
  });

  it('toEntry defaults method and headers when missing', async () => {
    mockListTools.mockResolvedValue([{ ...sampleRow, method: undefined, headers: undefined }]);

    const { toolAPI } = await import('../api');
    const result = await toolAPI.fetchAll();

    expect(result[0].method).toBe('GET');
    expect(result[0].headers).toBe('{}');
  });

  it('create calls createTool and returns entry', async () => {
    mockCreateTool.mockResolvedValue(sampleRow);

    const { toolAPI } = await import('../api');
    const data: ToolFormData = {
      name: 'New Tool',
      description: 'desc',
      category: 'utility',
      status: 'active',
      version: 'v1',
      endpoint: 'https://example.com',
      method: 'POST',
      headers: '{"X-Api-Key":"k"}',
      parameters: '{"type":"object"}',
    };
    const result = await toolAPI.create(data);

    expect(mockCreateTool).toHaveBeenCalledWith({
      name: 'New Tool',
      description: 'desc',
      category: 'utility',
      status: 'active',
      version: 'v1',
      endpoint: 'https://example.com',
      method: 'POST',
      headers: '{"X-Api-Key":"k"}',
      parameters: '{"type":"object"}',
    });
    expect(result.name).toBe('Tool 1');
  });

  it('update calls updateTool', async () => {
    mockUpdateTool.mockResolvedValue(undefined);

    const { toolAPI } = await import('../api');
    await toolAPI.update('t1', { name: 'Updated' });

    expect(mockUpdateTool).toHaveBeenCalledWith('t1', { name: 'Updated' });
  });

  it('remove calls deleteTool', async () => {
    mockDeleteTool.mockResolvedValue(undefined);

    const { toolAPI } = await import('../api');
    await toolAPI.remove('t1');

    expect(mockDeleteTool).toHaveBeenCalledWith('t1');
  });

  it('clone creates a copy', async () => {
    mockCreateTool.mockResolvedValue({ ...sampleRow, name: 'Original (副本)' });

    const { toolAPI } = await import('../api');
    const item: ToolEntry = {
      id: 't1',
      name: 'Original',
      description: 'desc',
      category: 'utility',
      status: 'active',
      version: 'v1',
      endpoint: 'https://example.com',
      method: 'POST',
      headers: '{"X-Key":"v"}',
      parameters: '{"type":"object"}',
      createdAt: '2024-01-01',
    };
    await toolAPI.clone(item);

    expect(mockCreateTool).toHaveBeenCalledWith({
      name: 'Original (副本)',
      description: 'desc',
      category: 'utility',
      status: 'active',
      version: 'v1',
      endpoint: 'https://example.com',
      method: 'POST',
      headers: '{"X-Key":"v"}',
      parameters: '{"type":"object"}',
    });
  });

  it('removeBatch deletes multiple', async () => {
    mockDeleteTool.mockResolvedValue(undefined);

    const { toolAPI } = await import('../api');
    await toolAPI.removeBatch(new Set(['t1', 't2', 't3']));

    expect(mockDeleteTool).toHaveBeenCalledTimes(3);
  });

  it('toEntry maps disabled status', async () => {
    mockListTools.mockResolvedValue([{ ...sampleRow, status: 'inactive' }]);

    const { toolAPI } = await import('../api');
    const result = await toolAPI.fetchAll();

    expect(result[0].status).toBe('disabled');
  });

  it('toEntry defaults parameters when missing', async () => {
    mockListTools.mockResolvedValue([{ ...sampleRow, parameters: undefined }]);

    const { toolAPI } = await import('../api');
    const result = await toolAPI.fetchAll();

    expect(result[0].parameters).toBe('{"type":"object","properties":{}}');
  });
});
