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

describe('DI setters', () => {
  it('promptAPI DI setter works', () => {
    const mock = noopService();
    setPromptAPI(mock);
    expect(promptAPI).toBe(mock);
  });

  it('outputAPI DI setter works', () => {
    const mock = noopService();
    setOutputAPI(mock);
    expect(outputAPI).toBe(mock);
  });

  it('toolAPI DI setter works', () => {
    const mock = noopService();
    setToolAPI(mock);
    expect(toolAPI).toBe(mock);
  });

  it('mcpAPI DI setter works', () => {
    const mock = noopService();
    setMCPAPI(mock);
    expect(mcpAPI).toBe(mock);
  });

  it('skillAPI DI setter works', () => {
    const mock = noopService();
    setSkillAPI(mock);
    expect(skillAPI).toBe(mock);
  });
});
