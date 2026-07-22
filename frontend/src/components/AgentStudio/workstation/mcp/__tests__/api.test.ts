import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MCPEntry, MCPFormData } from '../mcp.types';

const mockListMCPs = vi.fn();
const mockCreateMCP = vi.fn();
const mockUpdateMCP = vi.fn();
const mockDeleteMCP = vi.fn();

vi.mock('../../../../../api/client/mcps', () => ({
  listMCPs: mockListMCPs,
  createMCP: mockCreateMCP,
  updateMCP: mockUpdateMCP,
  deleteMCP: mockDeleteMCP,
}));

describe('mcp api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  const sampleRow = {
    id: 'm1',
    name: 'MCP 1',
    type: 'stdio',
    endpoint: '/usr/bin/cmd',
    config: JSON.stringify({ description: 'A tool', version: 'v1' }),
    status: 'active',
    created_at: '2024-01-15T00:00:00Z',
  };

  it('fetchAll returns mapped entries', async () => {
    mockListMCPs.mockResolvedValue([sampleRow]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('MCP 1');
    expect(result[0].type).toBe('stdio');
    expect(result[0].status).toBe('connected');
    expect(result[0].command).toBe('/usr/bin/cmd');
    expect(result[0].version).toBe('v1');
  });

  it('create calls createMCP and returns entry', async () => {
    mockCreateMCP.mockResolvedValue(sampleRow);

    const { mcpAPI } = await import('../api');
    const data: MCPFormData = {
      name: 'New MCP',
      type: 'stdio',
      command: '/usr/bin/cmd',
      url: '',
      description: 'desc',
      version: 'v1',
    };
    const result = await mcpAPI.create(data);

    expect(mockCreateMCP).toHaveBeenCalledWith({
      name: 'New MCP',
      type: 'stdio',
      endpoint: '/usr/bin/cmd',
      config: JSON.stringify({ description: 'desc', version: 'v1' }),
    });
    expect(result.name).toBe('MCP 1');
  });

  it('create uses url for sse type', async () => {
    mockCreateMCP.mockResolvedValue({ ...sampleRow, type: 'sse' });

    const { mcpAPI } = await import('../api');
    const data: MCPFormData = {
      name: 'SSE MCP',
      type: 'sse',
      command: '',
      url: 'https://example.com',
      description: 'desc',
      version: 'v1',
    };
    await mcpAPI.create(data);

    expect(mockCreateMCP).toHaveBeenCalledWith({
      name: 'SSE MCP',
      type: 'sse',
      endpoint: 'https://example.com',
      config: JSON.stringify({ description: 'desc', version: 'v1' }),
    });
  });

  it('update updates name and type', async () => {
    mockUpdateMCP.mockResolvedValue(undefined);

    const { mcpAPI } = await import('../api');
    await mcpAPI.update('m1', { name: 'Updated', type: 'sse' });

    expect(mockUpdateMCP).toHaveBeenCalledWith('m1', { name: 'Updated', type: 'sse' });
  });

  it('update uses command for stdio type', async () => {
    mockUpdateMCP.mockResolvedValue(undefined);

    const { mcpAPI } = await import('../api');
    await mcpAPI.update('m1', { type: 'stdio', command: '/new/cmd' });

    expect(mockUpdateMCP.mock.calls[0][1].endpoint).toBe('/new/cmd');
  });

  it('update uses url for sse type', async () => {
    mockUpdateMCP.mockResolvedValue(undefined);

    const { mcpAPI } = await import('../api');
    await mcpAPI.update('m1', { type: 'sse', url: 'https://new.example.com' });

    expect(mockUpdateMCP.mock.calls[0][1].endpoint).toBe('https://new.example.com');
  });

  it('update sends config when description or version changes', async () => {
    mockUpdateMCP.mockResolvedValue(undefined);

    const { mcpAPI } = await import('../api');
    await mcpAPI.update('m1', { description: 'new desc', version: 'v2' });

    const call = mockUpdateMCP.mock.calls[0][1];
    expect(call.config).toBe(JSON.stringify({ description: 'new desc', version: 'v2' }));
  });

  it('remove calls deleteMCP', async () => {
    mockDeleteMCP.mockResolvedValue(undefined);

    const { mcpAPI } = await import('../api');
    await mcpAPI.remove('m1');

    expect(mockDeleteMCP).toHaveBeenCalledWith('m1');
  });

  it('clone creates a copy', async () => {
    mockCreateMCP.mockResolvedValue({ ...sampleRow, name: 'Original (副本)' });

    const { mcpAPI } = await import('../api');
    const item: MCPEntry = {
      id: 'm1',
      name: 'Original',
      description: 'desc',
      type: 'stdio',
      status: 'connected',
      version: 'v1',
      command: '/usr/bin/cmd',
      url: '',
      createdAt: '2024-01-01',
    };
    await mcpAPI.clone(item);

    expect(mockCreateMCP).toHaveBeenCalledWith({
      name: 'Original (副本)',
      type: 'stdio',
      endpoint: '/usr/bin/cmd',
      config: JSON.stringify({ description: 'desc', version: 'v1' }),
    });
  });

  it('removeBatch deletes multiple', async () => {
    mockDeleteMCP.mockResolvedValue(undefined);

    const { mcpAPI } = await import('../api');
    await mcpAPI.removeBatch(new Set(['m1', 'm2']));

    expect(mockDeleteMCP).toHaveBeenCalledTimes(2);
  });

  it('toEntry maps disconnected status', async () => {
    mockListMCPs.mockResolvedValue([{ ...sampleRow, status: 'inactive' }]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result[0].status).toBe('disconnected');
  });

  it('toEntry uses description from config when available', async () => {
    mockListMCPs.mockResolvedValue([{
      ...sampleRow,
      config: JSON.stringify({ description: 'from config', version: 'v2' }),
    }]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result[0].description).toBe('from config');
    expect(result[0].version).toBe('v2');
  });

  it('toEntry falls back to name when no description', async () => {
    mockListMCPs.mockResolvedValue([{ ...sampleRow, config: '{}', name: 'FallbackName' }]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result[0].description).toBe('FallbackName');
  });

  it('parseConfig handles null', async () => {
    mockListMCPs.mockResolvedValue([{ ...sampleRow, config: null }]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result[0].version).toBe('v1.0.0');
  });

  it('parseConfig handles invalid JSON', async () => {
    mockListMCPs.mockResolvedValue([{ ...sampleRow, config: 'not-json', name: 'M1' }]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result[0].description).toBe('M1');
  });

  it('toEntry uses url for sse type', async () => {
    mockListMCPs.mockResolvedValue([{ ...sampleRow, type: 'sse', endpoint: 'https://mcp.example.com' }]);

    const { mcpAPI } = await import('../api');
    const result = await mcpAPI.fetchAll();

    expect(result[0].url).toBe('https://mcp.example.com');
    expect(result[0].command).toBe('');
  });
});
