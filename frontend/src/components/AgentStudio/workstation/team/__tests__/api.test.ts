import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TeamFormData } from '../team.types';

const mockListTeams = vi.fn();
const mockCreateTeam = vi.fn();
const mockUpdateTeam = vi.fn();
const mockDeleteTeam = vi.fn();

vi.mock('../../../../../api/client/teams', () => ({
  listTeams: mockListTeams,
  createTeam: mockCreateTeam,
  updateTeam: mockUpdateTeam,
  deleteTeam: mockDeleteTeam,
}));

describe('team api', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('fetchAll returns mapped entries', async () => {
    mockListTeams.mockResolvedValue([
      {
        id: 't1',
        name: 'Dev Team',
        description: 'Development team',
        status: 'active',
        created_at: '2024-01-15T00:00:00Z',
        order: 1,
        agents: [{ agentConfigId: 'a1', name: 'Agent1' }],
      },
    ]);

    const { teamAPI } = await import('../api');
    const result = await teamAPI.fetchAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dev Team');
    expect(result[0].category).toBe('dev');
    expect(result[0].status).toBe('active');
    expect(result[0].memberCount).toBe(1);
    expect(result[0].createdAt).toBe('2024-01-15');
  });

  it('fetchAll handles missing optional fields', async () => {
    mockListTeams.mockResolvedValue([
      { id: 't2', name: 'Minimal' },
    ]);

    const { teamAPI } = await import('../api');
    const result = await teamAPI.fetchAll();

    expect(result[0].description).toBe('');
    expect(result[0].status).toBe('active');
    expect(result[0].createdAt).toBe('');
    expect(result[0].memberCount).toBe(0);
  });

  it('deriveCategory returns test for test keywords', async () => {
    mockListTeams.mockResolvedValue([
      { id: 't3', name: '测试团队', description: '质量' },
    ]);

    const { teamAPI } = await import('../api');
    const result = await teamAPI.fetchAll();

    expect(result[0].category).toBe('test');
  });

  it('deriveCategory returns ops for devops keywords', async () => {
    mockListTeams.mockResolvedValue([
      { id: 't4', name: '运维团队', description: 'ci/cd pipeline' },
    ]);

    const { teamAPI } = await import('../api');
    const result = await teamAPI.fetchAll();

    expect(result[0].category).toBe('ops');
  });

  it('create calls createTeam and returns mapped entry', async () => {
    mockCreateTeam.mockResolvedValue({
      id: 'new-t1',
      name: 'New Team',
      description: 'A new team',
      status: 'active',
      created_at: '2024-06-01T00:00:00Z',
      agents: [],
    });

    const { teamAPI } = await import('../api');
    const data: TeamFormData = {
      name: 'New Team',
      description: 'A new team',
      status: 'active',
    };
    const result = await teamAPI.create(data);

    expect(mockCreateTeam).toHaveBeenCalledWith({
      name: 'New Team',
      description: 'A new team',
      status: 'active',
    });
    expect(result.name).toBe('New Team');
    expect(result.id).toBe('new-t1');
  });

  it('update calls updateTeam', async () => {
    mockUpdateTeam.mockResolvedValue(undefined);

    const { teamAPI } = await import('../api');
    await teamAPI.update('t1', { name: 'Updated' });

    expect(mockUpdateTeam).toHaveBeenCalledWith('t1', {
      name: 'Updated',
      description: undefined,
      status: undefined,
    });
  });

  it('remove calls deleteTeam', async () => {
    mockDeleteTeam.mockResolvedValue(undefined);

    const { teamAPI } = await import('../api');
    await teamAPI.remove('t1');

    expect(mockDeleteTeam).toHaveBeenCalledWith('t1');
  });

  it('removeBatch deletes multiple teams', async () => {
    mockDeleteTeam.mockResolvedValue(undefined);

    const { teamAPI } = await import('../api');
    const ids = new Set(['t1', 't2', 't3']);
    await teamAPI.removeBatch(ids);

    expect(mockDeleteTeam).toHaveBeenCalledTimes(3);
    expect(mockDeleteTeam).toHaveBeenCalledWith('t1');
    expect(mockDeleteTeam).toHaveBeenCalledWith('t2');
    expect(mockDeleteTeam).toHaveBeenCalledWith('t3');
  });
});
