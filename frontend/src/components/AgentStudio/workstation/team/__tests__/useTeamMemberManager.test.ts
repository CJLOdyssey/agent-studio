import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockListAgents = vi.fn();
const mockAddTeamMember = vi.fn();
const mockRemoveTeamMember = vi.fn();

vi.mock('../../../../../api/client/agents', () => ({
  listAgents: (...args: any[]) => mockListAgents(...args),
}));
vi.mock('../../../../../api/client/teams', () => ({
  addTeamMember: (...args: any[]) => mockAddTeamMember(...args),
  removeTeamMember: (...args: any[]) => mockRemoveTeamMember(...args),
}));

import useTeamMemberManager from '../useTeamMemberManager';
import type { TeamEntry } from '../team.types';

const mockTeam: TeamEntry = {
  id: 'team-1', name: 'Test Team', description: '', status: 'active', category: 'dev',
  createdAt: '', agentIds: [],
} as TeamEntry;

describe('useTeamMemberManager', () => {
  it('initializes with team members', () => {
    mockListAgents.mockResolvedValue([]);
    const teamWithAgents = { ...mockTeam, agents: [{ agentConfigId: 'a1', name: 'Agent 1' }] };
    const { result } = renderHook(() => useTeamMemberManager(teamWithAgents));
    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].name).toBe('Agent 1');
  });

  it('loads available agents on mount', async () => {
    mockListAgents.mockResolvedValue([
      { id: 'a1', name: 'Agent 1' },
      { id: 'a2', name: 'Agent 2' },
    ]);
    const { result } = renderHook(() => useTeamMemberManager(mockTeam));
    await waitFor(() => expect(result.current.availAgents).toHaveLength(2));
  });

  it('handles API error gracefully', async () => {
    mockListAgents.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useTeamMemberManager(mockTeam));
    await waitFor(() => expect(result.current.error).toBe('加载 Agent 列表失败'));
  });

  it('computes filteredAgents correctly', async () => {
    mockListAgents.mockResolvedValue([
      { id: 'a1', name: 'Agent 1' },
      { id: 'a2', name: 'Agent 2' },
    ]);
    const teamWithAgent = { ...mockTeam, agents: [{ agentConfigId: 'a1', name: 'Agent 1' }] };
    const { result } = renderHook(() => useTeamMemberManager(teamWithAgent));
    await waitFor(() => {
      expect(result.current.filteredAgents.map((a: any) => a.id)).toEqual(['a2']);
    });
  });

  it('handles handleAdd', async () => {
    mockListAgents.mockResolvedValue([]);
    mockAddTeamMember.mockResolvedValue({});
    const { result } = renderHook(() => useTeamMemberManager(mockTeam));
    await act(async () => { await result.current.handleAdd({ id: 'a1', name: 'Agent 1' }); });
    expect(mockAddTeamMember).toHaveBeenCalledWith('team-1', expect.objectContaining({ agent_config_id: 'a1' }));
  });

  it('handles handleRemove', async () => {
    mockListAgents.mockResolvedValue([]);
    mockRemoveTeamMember.mockResolvedValue({});
    const teamWithAgent = { ...mockTeam, agents: [{ agentConfigId: 'a1', name: 'Agent 1' }] };
    const { result } = renderHook(() => useTeamMemberManager(teamWithAgent));
    await act(async () => { await result.current.handleRemove('a1'); });
    expect(mockRemoveTeamMember).toHaveBeenCalledWith('team-1', 'a1');
  });
});
