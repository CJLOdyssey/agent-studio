import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListAgents = vi.fn();
const mockCreateAgent = vi.fn();
const mockUpdateAgent = vi.fn();
const mockDeleteAgent = vi.fn();
const mockListTeams = vi.fn().mockResolvedValue([]);
const mockListPrompts = vi.fn().mockResolvedValue([]);
const mockListTools = vi.fn().mockResolvedValue([]);
const mockListMCPs = vi.fn().mockResolvedValue([]);
const mockListSkills = vi.fn().mockResolvedValue([]);

vi.mock('../../../../../api/client/agents', () => ({
  listAgents: mockListAgents,
  createAgent: mockCreateAgent,
  updateAgent: mockUpdateAgent,
  deleteAgent: mockDeleteAgent,
}));

vi.mock('../../../../../api/client/teams', () => ({
  listTeams: mockListTeams,
}));

vi.mock('../../../../../api/client/prompts', () => ({
  listPrompts: mockListPrompts,
}));

vi.mock('../../../../../api/client/tools', () => ({
  listTools: mockListTools,
}));

vi.mock('../../../../../api/client/mcps', () => ({
  listMCPs: mockListMCPs,
}));

vi.mock('../../../../../api/client/skills', () => ({
  listSkills: mockListSkills,
}));

describe('agent api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockListTeams.mockResolvedValue([]);
    mockListPrompts.mockResolvedValue([]);
    mockListTools.mockResolvedValue([]);
    mockListMCPs.mockResolvedValue([]);
    mockListSkills.mockResolvedValue([]);
  });

  const sampleAgent = {
    id: 'a1',
    name: 'Agent 1',
    role_identifier: 'agent_abc12345',
    system_prompt: 'You are helpful',
    output_constraints: JSON.stringify({
      description: 'An agent',
      team: 'Team A',
      version: 'v1.0.0',
      systemPromptId: '',
    }),
    tools: [],
    mcp: [],
    skills: [],
    order: 0,
    is_active: true,
    is_approver: false,
    icon: '🤖',
    model: null,
    temperature: null,
    created_at: '2024-01-15T00:00:00Z',
  };

  it('fetchAll returns mapped entries', async () => {
    mockListAgents.mockResolvedValue([sampleAgent]);

    const { agentAPI } = await import('../api');
    const result = await agentAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Agent 1');
    expect(result[0].status).toBe('running');
  });

  it('fetchAll enriches with team names', async () => {
    mockListAgents.mockResolvedValue([sampleAgent]);
    mockListTeams.mockResolvedValue([
      {
        id: 't1',
        name: 'Team Alpha',
        agents: [{ agentConfigId: 'a1', name: 'Agent 1' }],
      },
      {
        id: 't2',
        name: 'Team Beta',
        agents: [{ agentConfigId: 'a1', name: 'Agent 1' }],
      },
    ]);

    const { agentAPI } = await import('../api');
    const result = await agentAPI.fetchAll();

    expect(result[0].teams).toEqual(['Team Alpha', 'Team Beta']);
  });

  it('remove calls deleteAgent', async () => {
    mockDeleteAgent.mockResolvedValue(undefined);

    const { agentAPI } = await import('../api');
    await agentAPI.remove('a1');

    expect(mockDeleteAgent).toHaveBeenCalledWith('a1');
  });

  it('removeBatch deletes multiple', async () => {
    mockDeleteAgent.mockResolvedValue(undefined);

    const { agentAPI } = await import('../api');
    await agentAPI.removeBatch(new Set(['a1', 'a2']));

    expect(mockDeleteAgent).toHaveBeenCalledTimes(2);
  });

  it('setAgentAPI replaces implementation', async () => {
    const { agentAPI: origAPI, setAgentAPI } = await import('../api');

    const mockAPI = {
      fetchAll: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      clone: vi.fn(),
      removeBatch: vi.fn(),
    };

    setAgentAPI(mockAPI);
    const { agentAPI: newAPI } = await import('../api');
    const result = await newAPI.fetchAll();
    expect(result).toEqual([]);
    expect(mockAPI.fetchAll).toHaveBeenCalledTimes(1);
  });
});
