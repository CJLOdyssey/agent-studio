import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Bot } from 'lucide-react';
import type { Team, Agent } from '../../types/AgentStudio';

vi.mock('../../api/client/teams', () => ({
  addTeamMember: vi.fn().mockResolvedValue({ id: 'new-agent', name: '新 Agent', role: '待配置角色' }),
  linkAgentToMember: vi.fn().mockResolvedValue(undefined),
  removeTeamMember: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../api/client/agents', () => ({
  updateAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/validation', () => ({
  validateName: vi.fn((name: string) => {
    if (!name.trim()) return { valid: false, error: 'Name empty' };
    if (name.includes('<')) return { valid: false, error: 'Invalid chars' };
    return { valid: true };
  }),
  checkAgentLimit: vi.fn((count: number) => {
    if (count >= 20) return { valid: false, error: 'Agent limit reached' };
    return { valid: true };
  }),
}));

vi.mock('../useTeamData', () => ({
  removeConversationsByAgentIds: vi.fn(),
}));

import { useTeamAgents } from '../useTeamAgents';

function makeTeam(id: string, agents: Agent[] = []): Team {
  return {
    id,
    name: 'Team ' + id,
    isExpanded: false,
    isPinned: false,
    agents,
  };
}

function makeAgent(id: string): Agent {
  return {
    id,
    name: 'Agent ' + id,
    role: 'developer',
    icon: Bot,
    color: 'text-[var(--da-text-muted)]',
    bg: 'bg-[var(--da-bg-surface)]',
    border: 'border-[var(--da-border)]',
  };
}

describe('useTeamAgents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all action handlers', () => {
    const { result } = renderHook(() => useTeamAgents([], vi.fn()));

    expect(result.current.handleAddAgent).toBeDefined();
    expect(result.current.handleRenameAgent).toBeDefined();
    expect(result.current.handleDeleteAgent).toBeDefined();
    expect(result.current.handleAgentConfigSave).toBeDefined();
    expect(result.current.replaceAgentId).toBeDefined();
    expect(result.current.linkMemberAgent).toBeDefined();
  });

  describe('handleAddAgent', () => {
    it('adds an agent to a team', async () => {
      const { addTeamMember } = await import('../../api/client/teams');
      const setTeams = vi.fn();
      const team = makeTeam('t1');

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      await act(async () => {
        await result.current.handleAddAgent('t1');
      });

      expect(addTeamMember).toHaveBeenCalledWith('t1', { name: expect.any(String) });
      const updater = setTeams.mock.calls[0][0];
      const updated = updater([team]);
      expect(updated[0].agents).toHaveLength(1);
      expect(updated[0].isExpanded).toBe(true);
    });

    it('does nothing if team not found', async () => {
      const setTeams = vi.fn();
      const team = makeTeam('t1');

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      await act(async () => {
        await result.current.handleAddAgent('non-existent');
      });

      expect(setTeams).not.toHaveBeenCalled();
    });

    it('shows toast on error', async () => {
      const { addTeamMember } = await import('../../api/client/teams');
      (addTeamMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Fail'));
      const setTeams = vi.fn();
      const toast = vi.fn();
      const team = makeTeam('t1');

      const { result } = renderHook(() => useTeamAgents([team], setTeams, toast));

      await act(async () => {
        await result.current.handleAddAgent('t1');
      });

      expect(toast).toHaveBeenCalledWith('添加 Agent 失败', 'error');
    });
  });

  describe('handleRenameAgent', () => {
    it('renames an agent', () => {
      const setTeams = vi.fn();
      const agent = makeAgent('a1');
      agent.name = 'Old Name';
      const team = makeTeam('t1', [agent]);

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      act(() => {
        result.current.handleRenameAgent('a1', 'New Name');
      });

      expect(setTeams).toHaveBeenCalled();
      const updater = setTeams.mock.calls[0][0];
      const updated = updater([team]);
      expect(updated[0].agents[0].name).toBe('New Name');
    });

    it('does nothing when name is empty after trim', () => {
      const setTeams = vi.fn();
      const agent = makeAgent('a1');
      const team = makeTeam('t1', [agent]);

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      act(() => {
        result.current.handleRenameAgent('a1', '   ');
      });

      expect(setTeams).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteAgent', () => {
    it('removes agent from team', async () => {
      const setTeams = vi.fn();
      const agent = makeAgent('a1');
      const team = makeTeam('t1', [agent]);

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      await act(async () => {
        await result.current.handleDeleteAgent('t1', 'a1');
      });

      const updater = setTeams.mock.calls[0][0];
      const updated = updater([team]);
      expect(updated[0].agents).toHaveLength(0);
    });
  });

  describe('handleAgentConfigSave', () => {
    it('updates agent in team', () => {
      const setTeams = vi.fn();
      const agent = makeAgent('a1');
      const team = makeTeam('t1', [agent]);

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      const updatedAgent: Agent = { ...agent, name: 'Updated', role: 'updated-role' };

      act(() => {
        result.current.handleAgentConfigSave(updatedAgent);
      });

      const updater = setTeams.mock.calls[0][0];
      const updated = updater([team]);
      expect(updated[0].agents[0].name).toBe('Updated');
      expect(updated[0].agents[0].role).toBe('updated-role');
    });
  });

  describe('replaceAgentId', () => {
    it('replaces agent id', () => {
      const setTeams = vi.fn();
      const agent = makeAgent('old-id');
      const team = makeTeam('t1', [agent]);

      const { result } = renderHook(() => useTeamAgents([team], setTeams));

      act(() => {
        result.current.replaceAgentId('old-id', 'new-id');
      });

      const updater = setTeams.mock.calls[0][0];
      const updated = updater([team]);
      expect(updated[0].agents[0].id).toBe('new-id');
    });
  });

  describe('linkMemberAgent', () => {
    it('calls linkAgentToMember', async () => {
      const { linkAgentToMember } = await import('../../api/client/teams');
      const { result } = renderHook(() => useTeamAgents([], vi.fn()));

      await act(async () => {
        await result.current.linkMemberAgent('t1', 'm1', 'ac1');
      });

      expect(linkAgentToMember).toHaveBeenCalledWith('t1', 'm1', 'ac1');
    });

    it('does not throw on error', async () => {
      const { linkAgentToMember } = await import('../../api/client/teams');
      (linkAgentToMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useTeamAgents([], vi.fn()));

      await expect(act(async () => {
        await result.current.linkMemberAgent('t1', 'm1', 'ac1');
      })).resolves.toBeUndefined();
    });
  });
});
