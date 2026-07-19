import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../api/client/prompts', () => ({
  listPrompts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../../api/client/tools', () => ({
  listTools: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../../api/client/mcps', () => ({
  listMCPs: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../../api/client/skills', () => ({
  listSkills: vi.fn().mockResolvedValue([]),
}));

import { backendToEntry, resolveLists } from '../mappers';
import type { AgentConfig } from '../../../../../types';

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    id: 'a1',
    name: 'Test Agent',
    role_identifier: 'developer',
    system_prompt: 'You are a helpful assistant',
    model: 'gpt-4',
    temperature: 0.7,
    order: 1,
    is_active: true,
    is_approver: false,
    icon: '🤖',
    created_at: '2024-01-15T10:30:00Z',
    output_constraints: null,
    tools: [],
    mcp: [],
    skills: [],
    ...overrides,
  };
}

describe('backendToEntry', () => {
  it('converts basic agent config', () => {
    const entry = backendToEntry(makeConfig());
    expect(entry.id).toBe('a1');
    expect(entry.name).toBe('Test Agent');
    expect(entry.model).toBe('gpt-4');
    expect(entry.status).toBe('running');
    expect(entry.version).toBe('v1.0.0');
    expect(entry.createdAt).toBe('2024-01-15');
  });

  it('converts inactive agent to stopped status', () => {
    const entry = backendToEntry(makeConfig({ is_active: false }));
    expect(entry.status).toBe('stopped');
  });

  it('parses output_constraints meta', () => {
    const entry = backendToEntry(makeConfig({
      output_constraints: JSON.stringify({ description: 'Test desc', team: 'Team A', version: 'v2.0.0', systemPromptId: 'sp1' }),
    }));
    expect(entry.description).toBe('Test desc');
    expect(entry.team).toBe('Team A');
    expect(entry.version).toBe('v2.0.0');
    expect(entry.systemPromptId).toBe('sp1');
  });

  it('handles null output_constraints', () => {
    const entry = backendToEntry(makeConfig({ output_constraints: null }));
    expect(entry.description).toBe('');
    expect(entry.team).toBe('');
  });

  it('handles invalid JSON in output_constraints', () => {
    const entry = backendToEntry(makeConfig({ output_constraints: 'not-json' }));
    expect(entry.description).toBe('');
  });

  it('maps tool/mcp/skill IDs from string arrays', () => {
    const entry = backendToEntry(makeConfig({
      tools: JSON.stringify([{ id: 't1', name: 'Tool1' }]),
      mcp: JSON.stringify([{ id: 'm1', name: 'MCP1' }]),
      skills: JSON.stringify([{ id: 's1', name: 'Skill1' }]),
    }));
    expect(entry.toolIds).toEqual(['t1']);
    expect(entry.mcpIds).toEqual(['m1']);
    expect(entry.skillIds).toEqual(['s1']);
  });

  it('handles already-parsed tool arrays', () => {
    const entry = backendToEntry(makeConfig({
      tools: [{ id: 't1' }, { name: 't2' }] as unknown as string,
      mcp: [],
      skills: [],
    }));
    expect(entry.toolIds).toEqual(['t1', 't2']);
  });

  it('handles missing created_at', () => {
    const entry = backendToEntry(makeConfig({ created_at: null }));
    expect(entry.createdAt).toBe('');
  });
});

describe('resolveLists', () => {
  it('resolves all lists in parallel', async () => {
    const { listPrompts } = await import('../../../../../api/client/prompts');
    const { listTools } = await import('../../../../../api/client/tools');
    (listPrompts as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'sp1', content: 'system prompt content' }]);
    (listTools as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 't1', name: 'Tool1', description: 'A tool' }]);

    const result = await resolveLists('sp1', ['t1'], [], []);

    expect(result.system_prompt).toBe('system prompt content');
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('Tool1');
    expect(result.mcp).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
  });

  it('returns empty string for missing prompt', async () => {
    const result = await resolveLists('nonexistent', [], [], []);
    expect(result.system_prompt).toBe('');
  });

  it('handles API errors gracefully', async () => {
    const { listPrompts } = await import('../../../../../api/client/prompts');
    (listPrompts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const result = await resolveLists('sp1', [], [], []);
    expect(result.system_prompt).toBe('');
  });

  it('filters tools/mcp/skills by ID', async () => {
    const { listTools } = await import('../../../../../api/client/tools');
    const { listMCPs } = await import('../../../../../api/client/mcps');
    const { listSkills } = await import('../../../../../api/client/skills');

    (listTools as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 't1', name: 'Tool1', description: 'T1' },
      { id: 't2', name: 'Tool2', description: 'T2' },
    ]);
    (listMCPs as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm1', name: 'MCP1', endpoint: 'https://mcp.example.com' },
    ]);
    (listSkills as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 's1', name: 'Skill1', description: 'S1' },
    ]);

    const result = await resolveLists('', ['t2'], ['m1'], ['s1']);

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].id).toBe('t2');
    expect(result.mcp).toHaveLength(1);
    expect(result.mcp[0].serverUrl).toBe('https://mcp.example.com');
    expect(result.skills).toHaveLength(1);
  });
});
