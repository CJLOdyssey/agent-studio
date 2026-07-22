import { useEffect, useState, useMemo, useCallback } from 'react';
import type { TeamEntry } from './team.types';
import type { TeamMember } from '../../../../types/team';
import { listAgents } from '../../../../api/client/agents';
import { addTeamMember, removeTeamMember } from '../../../../api/client/teams';

export default function useTeamMemberManager(team: TeamEntry) {
  const [members, setMembers] = useState<TeamMember[]>(team.agents || []);
  const [availAgents, setAvailAgents] = useState<{ id: string; name: string }[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAgents().then((items) => {
      if (!cancelled) setAvailAgents(items.map((a) => ({ id: a.id, name: a.name })));
    }).catch(() => {
      if (!cancelled) setError('加载 Agent 列表失败');
    });
    return () => { cancelled = true; };
  }, []);

  const memberAgentIds = useMemo(
    () => new Set(members.map((m) => m.agentConfigId).filter(Boolean)),
    [members],
  );

  const nonMemberAgents = useMemo(
    () => availAgents.filter((a) => !memberAgentIds.has(a.id)),
    [availAgents, memberAgentIds],
  );

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return nonMemberAgents;
    const q = agentSearch.toLowerCase();
    return nonMemberAgents.filter((a) => a.name.toLowerCase().includes(q));
  }, [nonMemberAgents, agentSearch]);

  const handleAdd = useCallback(async (agent: { id: string; name: string }) => {
    setAddingId(agent.id);
    setError(null);
    try {
      const newMember = await addTeamMember(team.id, {
        name: agent.name,
        role: '成员',
        agent_config_id: agent.id,
      });
      setMembers((prev) => [...prev, newMember]);
    } catch {
      setError(`添加「${agent.name}」失败`);
    }
    setAddingId(null);
  }, [team.id]);

  const handleRemove = useCallback(async (memberId: string) => {
    setRemovingId(memberId);
    setError(null);
    try {
      await removeTeamMember(team.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      setError('移除失败');
    }
    setRemovingId(null);
  }, [team.id]);

  return {
    members,
    availAgents,
    agentSearch,
    setAgentSearch,
    filteredAgents,
    handleAdd,
    handleRemove,
    removingId,
    addingId,
    error,
    setError,
  };
}
