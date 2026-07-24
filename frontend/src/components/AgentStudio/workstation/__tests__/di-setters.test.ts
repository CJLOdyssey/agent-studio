import { describe, it, expect, vi } from 'vitest';
import {
  promptAPI,
  setPromptAPI,
  type PromptAPIService,
} from '../prompt/api';
import {
  outputAPI,
  setOutputAPI,
  type OutputAPIService,
} from '../output/api';
import {
  toolAPI,
  setToolAPI,
  type ToolAPIService,
} from '../tool/api';
import {
  mcpAPI,
  setMCPAPI,
  type MCPAPIService,
} from '../mcp/api';
import {
  skillAPI,
  setSkillAPI,
  type SkillAPIService,
} from '../skill/api';

const noopService = (overrides = {}) =>
  ({
    fetchAll: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    clone: vi.fn(),
    removeBatch: vi.fn(),
    ...overrides,
  }) as unknown as PromptAPIService & OutputAPIService & ToolAPIService & MCPAPIService & SkillAPIService;

describe('DI setters', { tags: ['integration'] }, () => {
  it('promptAPI DI setter works', async () => {
    const mock = noopService();
    setPromptAPI(mock);
    const result = await promptAPI.fetchAll();
    expect(result).toEqual([]);
    expect(mock.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('outputAPI DI setter works', async () => {
    const mock = noopService();
    setOutputAPI(mock);
    const result = await outputAPI.fetchAll();
    expect(result).toEqual([]);
    expect(mock.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('toolAPI DI setter works', async () => {
    const mock = noopService();
    setToolAPI(mock);
    const result = await toolAPI.fetchAll();
    expect(result).toEqual([]);
    expect(mock.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('mcpAPI DI setter works', async () => {
    const mock = noopService();
    setMCPAPI(mock);
    const result = await mcpAPI.fetchAll();
    expect(result).toEqual([]);
    expect(mock.fetchAll).toHaveBeenCalledTimes(1);
  });

  it('skillAPI DI setter works', async () => {
    const mock = noopService();
    setSkillAPI(mock);
    const result = await skillAPI.fetchAll();
    expect(result).toEqual([]);
    expect(mock.fetchAll).toHaveBeenCalledTimes(1);
  });
});
