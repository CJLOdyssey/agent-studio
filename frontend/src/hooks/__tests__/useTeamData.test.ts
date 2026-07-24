import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../api/client/teams', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
  createTeam: vi.fn().mockResolvedValue({ id: 'new-team', name: '新团队' }),
  updateTeam: vi.fn().mockResolvedValue(undefined),
  deleteTeam: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/validation', () => ({
  validateName: vi.fn((name: string) => {
    if (!name.trim()) return { valid: false, error: 'Name empty' };
    return { valid: true };
  }),
  checkTeamLimit: vi.fn((count: number) => {
    if (count >= 50) return { valid: false, error: 'Team limit reached' };
    return { valid: true };
  }),
  checkAgentLimit: vi.fn(() => ({ valid: true })),
}));

import { useTeamData, removeConversationsByAgentIds, teamMemberToAgent } from '../useTeamData';
import { listTeams, updateTeam, deleteTeam } from '../../api/client/teams';
import type { TeamMember } from '../../types/team';

describe('removeConversationsByAgentIds', { tags: ['unit'] }, () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes conversations matching agent ids', () => {
    const convs = [
      { agentId: 'a1', title: 'First' },
      { agentId: 'a2', title: 'Second' },
      { agentId: 'a1', title: 'Third' },
    ];
    localStorage.setItem('agentstudio-conversations', JSON.stringify(convs));

    removeConversationsByAgentIds(['a1']);

    const saved = JSON.parse(localStorage.getItem('agentstudio-conversations') || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].agentId).toBe('a2');
  });

  it('no-ops when agentIds is empty', () => {
    const convs = [{ agentId: 'a1', title: 'First' }];
    localStorage.setItem('agentstudio-conversations', JSON.stringify(convs));

    removeConversationsByAgentIds([]);

    const saved = JSON.parse(localStorage.getItem('agentstudio-conversations') || '[]');
    expect(saved).toHaveLength(1);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('agentstudio-conversations', 'invalid');
    expect(() => removeConversationsByAgentIds(['a1'])).not.toThrow();
  });
});

describe('teamMemberToAgent', { tags: ['unit'] }, () => {
  it('converts team member to agent', () => {
    const member: TeamMember = {
      id: 'm1',
      name: 'Test Agent',
      role: 'developer',
      tools: JSON.stringify([{ name: 'tool1', enabled: true }]),
      mcp: JSON.stringify([{ name: 'mcp1', enabled: false }]),
      skills: JSON.stringify([{ name: 'skill1', enabled: true }]),
    };

    const agent = teamMemberToAgent(member);
    expect(agent.id).toBe('m1');
    expect(agent.name).toBe('Test Agent');
    expect(agent.role).toBe('developer');
    expect(agent.tools).toHaveLength(1);
    expect(agent.tools[0].name).toBe('tool1');
    expect(agent.mcp[0].enabled).toBe(false);
    expect(agent.skills[0].name).toBe('skill1');
  });

  it('handles member with agent_config_id', () => {
    const member = { id: 'm1', name: 'Agent', agent_config_id: 'ac-1', tools: [], mcp: [], skills: [] } as unknown as TeamMember;
    const agent = teamMemberToAgent(member);
    expect(agent.id).toBe('ac-1');
  });

  it('handles invalid JSON arrays gracefully', () => {
    const member = { id: 'm1', name: 'Agent', tools: 'not-json', mcp: 'also-not-json', skills: [] } as unknown as TeamMember;
    expect(() => teamMemberToAgent(member)).not.toThrow();
  });

  it('handles already-parsed arrays', () => {
    const member = { id: 'm1', name: 'Agent', tools: [{ name: 't1' }], mcp: [], skills: [] } as unknown as TeamMember;
    const agent = teamMemberToAgent(member);
    expect(agent.tools[0].name).toBe('t1');
  });
});

describe('useTeamData - sync operations', { tags: ['unit'] }, () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns hook with all methods', () => {
    const { result } = renderHook(() => useTeamData());

    expect(result.current.teams).toBeDefined();
    expect(result.current.setTeams).toBeDefined();
    expect(result.current.toggleTeam).toBeDefined();
    expect(result.current.handleAddTeam).toBeDefined();
    expect(result.current.startEditTeam).toBeDefined();
    expect(result.current.saveEditTeam).toBeDefined();
    expect(result.current.cancelEditTeam).toBeDefined();
    expect(result.current.handleRename).toBeDefined();
    expect(result.current.handleDeleteTeam).toBeDefined();
    expect(result.current.handleTogglePinTeam).toBeDefined();
    expect(result.current.allAgents).toEqual([]);
  });

  it('editing team state management', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setEditTeamName('Manual edit');
    });
    expect(result.current.editTeamName).toBe('Manual edit');
  });
});

describe('useTeamData - team operations (local state)', { tags: ['unit'] }, () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (listTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('setTeams directly updates state', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'Direct', isExpanded: false, isPinned: true, agents: [] }]);
    });

    expect(result.current.teams).toHaveLength(1);
    expect(result.current.teams[0].name).toBe('Direct');
    expect(result.current.teams[0].isPinned).toBe(true);
  });

  it('toggleTeam toggles expansion', async () => {
    (listTeams as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 't1', name: 'Team 1', is_expanded: false, agents: [] },
    ]);

    const { result } = renderHook(() => useTeamData());

    await waitFor(() => {
      expect(result.current.teams).toHaveLength(1);
    });

    await act(async () => {
      await result.current.toggleTeam('t1');
    });

    expect(result.current.teams[0].isExpanded).toBe(true);
  });

  it('handleRename changes name', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'Old', isExpanded: false, isPinned: false, agents: [] }]);
    });

    act(() => {
      result.current.handleRename('t1', 'NewName');
    });

    expect(result.current.teams[0].name).toBe('NewName');
    expect(updateTeam).toHaveBeenCalledWith('t1', { name: 'NewName' });
  });

  it('handleRename ignores empty name', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'Old', isExpanded: false, isPinned: false, agents: [] }]);
    });

    act(() => {
      result.current.handleRename('t1', '   ');
    });

    expect(result.current.teams[0].name).toBe('Old');
  });

  it('handleTogglePinTeam toggles pin', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'Team', isExpanded: false, isPinned: false, agents: [] }]);
    });

    act(() => {
      result.current.handleTogglePinTeam('t1');
    });
    expect(result.current.teams[0].isPinned).toBe(true);

    act(() => {
      result.current.handleTogglePinTeam('t1');
    });
    expect(result.current.teams[0].isPinned).toBe(false);
  });

  it('handleTogglePinTeam moves pinned to top', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([
        { id: 't1', name: 'A', isExpanded: false, isPinned: false, agents: [] },
        { id: 't2', name: 'B', isExpanded: false, isPinned: false, agents: [] },
      ]);
    });

    act(() => {
      result.current.handleTogglePinTeam('t2');
    });

    expect(result.current.teams[0].id).toBe('t2');
    expect(result.current.teams[1].id).toBe('t1');
  });

  it('handleDeleteTeam removes team', async () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'Team', isExpanded: false, isPinned: false, agents: [] }]);
    });

    await act(async () => {
      await result.current.handleDeleteTeam('t1');
    });

    expect(result.current.teams).toHaveLength(0);
    expect(deleteTeam).toHaveBeenCalledWith('t1');
  });

  it('handleDeleteTeam cleans up agent conversations', async () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{
        id: 't1',
        name: 'Team',
        isExpanded: false,
        isPinned: false,
        agents: [{ id: 'a1', name: 'Agent' } as never],
      }]);
    });

    const convs = [{ agentId: 'a1', title: 'Chat' }];
    localStorage.setItem('agentstudio-conversations', JSON.stringify(convs));

    await act(async () => {
      await result.current.handleDeleteTeam('t1');
    });

    expect(result.current.teams).toHaveLength(0);
    const saved = JSON.parse(localStorage.getItem('agentstudio-conversations') || '[]');
    expect(saved).toHaveLength(0);
  });
});

describe('useTeamData - editing flow', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listTeams as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('startEditTeam sets editingId and editName', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.startEditTeam({ id: 't1', name: 'ToEdit', isExpanded: false, isPinned: false, agents: [] });
    });

    expect(result.current.editingTeamId).toBe('t1');
    expect(result.current.editTeamName).toBe('ToEdit');
  });

  it('cancelEditTeam clears editing state', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.startEditTeam({ id: 't1', name: 'ToEdit', isExpanded: false, isPinned: false, agents: [] });
    });

    act(() => {
      result.current.cancelEditTeam();
    });

    expect(result.current.editingTeamId).toBeNull();
    expect(result.current.editTeamName).toBe('');
  });

  it('handleTeamNameKeyDown Enter calls save', async () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'OldName', isExpanded: false, isPinned: false, agents: [] }]);
      result.current.startEditTeam({ id: 't1', name: 'OldName', isExpanded: false, isPinned: false, agents: [] });
    });

    act(() => {
      result.current.setEditTeamName('NewSaved');
    });

    act(() => {
      result.current.handleTeamNameKeyDown({ key: 'Enter' } as React.KeyboardEvent);
    });

    expect(result.current.teams[0].name).toBe('NewSaved');
    expect(result.current.editingTeamId).toBeNull();
  });

  it('handleTeamNameKeyDown Escape cancels', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.startEditTeam({ id: 't1', name: 'ToEdit', isExpanded: false, isPinned: false, agents: [] });
    });

    act(() => {
      result.current.handleTeamNameKeyDown({ key: 'Escape' } as React.KeyboardEvent);
    });

    expect(result.current.editingTeamId).toBeNull();
  });

  it('saveTeamName delegates to saveEditTeam', () => {
    const { result } = renderHook(() => useTeamData());

    act(() => {
      result.current.setTeams([{ id: 't1', name: 'OldName', isExpanded: false, isPinned: false, agents: [] }]);
      result.current.startEditTeam({ id: 't1', name: 'OldName', isExpanded: false, isPinned: false, agents: [] });
      result.current.setEditTeamName('Renamed');
    });

    act(() => {
      result.current.saveTeamName();
    });

    expect(result.current.teams[0].name).toBe('Renamed');
  });
});
