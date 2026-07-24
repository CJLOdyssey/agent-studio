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

import { listTeams, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, linkAgentToMember } from '../teams';

beforeEach(() => {
  vi.resetAllMocks();
});

const mockTeam = {
  id: '1', name: 'Team A', order: 0, is_expanded: true, agents: [],
  created_at: '2024-01-01', description: null, status: null,
};

describe('listTeams', { tags: ['unit'] }, () => {
  it('calls GET /teams', async () => {
    mockApi.get.mockResolvedValue({ data: [mockTeam] });

    const result = await listTeams();

    expect(mockApi.get).toHaveBeenCalledWith('/teams');
    expect(result).toEqual([mockTeam]);
  });
});

describe('createTeam', { tags: ['unit'] }, () => {
  it('calls POST /teams with payload', async () => {
    mockApi.post.mockResolvedValue({ data: mockTeam });

    const result = await createTeam({ name: 'Team A' });

    expect(mockApi.post).toHaveBeenCalledWith('/teams', { name: 'Team A' });
    expect(result).toEqual(mockTeam);
  });
});

describe('updateTeam', { tags: ['unit'] }, () => {
  it('calls PUT /teams/:id with payload', async () => {
    mockApi.put.mockResolvedValue({ data: { ...mockTeam, name: 'Updated' } });

    const result = await updateTeam('1', { name: 'Updated' });

    expect(mockApi.put).toHaveBeenCalledWith('/teams/1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });
});

describe('deleteTeam', { tags: ['unit'] }, () => {
  it('calls DELETE /teams/:id', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteTeam('1');

    expect(mockApi.delete).toHaveBeenCalledWith('/teams/1');
  });
});

describe('addTeamMember', { tags: ['unit'] }, () => {
  it('calls POST /teams/:id/members with payload', async () => {
    const member = { name: 'Agent1', role: 'developer' };
    mockApi.post.mockResolvedValue({ data: member });

    const result = await addTeamMember('1', { name: 'Agent1', role: 'developer' });

    expect(mockApi.post).toHaveBeenCalledWith('/teams/1/members', { name: 'Agent1', role: 'developer' });
    expect(result).toEqual(member);
  });
});

describe('removeTeamMember', { tags: ['unit'] }, () => {
  it('calls DELETE /teams/:teamId/members/:memberId', async () => {
    mockApi.delete.mockResolvedValue({});

    await removeTeamMember('1', 'm1');

    expect(mockApi.delete).toHaveBeenCalledWith('/teams/1/members/m1');
  });
});

describe('linkAgentToMember', { tags: ['unit'] }, () => {
  it('calls PUT with agent_config_id', async () => {
    mockApi.put.mockResolvedValue({});

    await linkAgentToMember('team-1', 'member-1', 'agent-1');

    expect(mockApi.put).toHaveBeenCalledWith('/teams/team-1/members/member-1/link-agent', {
      agent_config_id: 'agent-1',
    });
  });
});
