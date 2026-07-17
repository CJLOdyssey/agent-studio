import { useCallback } from 'react';
import { Bot } from 'lucide-react';
import type { Agent, Team } from '../types/agentstudio';
import { validateName, checkAgentLimit } from '../utils/validation';
import { updateAgent } from '../api/client/agents';
import { addTeamMember, linkAgentToMember, removeTeamMember } from '../api/client/teams';
import { removeConversationsByAgentIds } from './useTeamData';

type ToastFn = (msg: string, type: 'success' | 'info' | 'error') => void;

export function useTeamAgents(
  teams: Team[],
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>,
  toast?: ToastFn,
) {
  const handleAddAgent = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const limitCheck = checkAgentLimit(team.agents.length);
      if (!limitCheck.valid) {
        toast?.(limitCheck.error!, 'error');
        return;
      }

      let agentName = '新 Agent';
      const existingNames = team.agents.map((a) => a.name);
      if (existingNames.includes(agentName)) {
        let counter = 2;
        while (existingNames.includes(`${agentName} (${counter})`)) {
          counter++;
        }
        agentName = `${agentName} (${counter})`;
      }

      try {
        const member = await addTeamMember(teamId, { name: agentName });
        const newAgent: Agent = {
          id: member.id,
          name: member.name,
          role: member.role || '待配置角色',
          icon: Bot,
          color: 'text-[var(--da-text-muted)]',
          bg: 'bg-[var(--da-bg-surface)]',
          border: 'border-[var(--da-border)]',
        };
        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, isExpanded: true, agents: [...t.agents, newAgent] } : t)),
        );
        toast?.('Agent 已添加', 'success');
      } catch {
        toast?.('添加 Agent 失败', 'error');
      }
    },
    [teams, toast, setTeams],
  );

  const handleRenameAgent = useCallback((agentId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    let existingNames: string[] = [];
    let agentConfigId: string | undefined;
    teams.forEach((team) => {
      team.agents.forEach((a) => {
        if (a.id === agentId) {
          existingNames = team.agents.filter((x) => x.id !== agentId).map((x) => x.name);
          agentConfigId = a.agentConfigId;
        }
      });
    });
    const validation = validateName(trimmed, existingNames);
    if (!validation.valid) {
      toast?.(validation.error!, 'error');
      return;
    }
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        agents: t.agents.map((a) => (a.id === agentId ? { ...a, name: trimmed } : a)),
      })),
    );
    const apiId = agentConfigId || agentId;
    updateAgent(apiId, { name: trimmed }).catch(() => {});
  }, [teams, toast, setTeams]);

  const handleDeleteAgent = useCallback(async (teamId: string, agentId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, agents: t.agents.filter((a) => a.id !== agentId) } : t)),
    );
    removeConversationsByAgentIds([agentId]);
    await removeTeamMember(teamId, agentId).catch(() => {});
  }, [setTeams]);

  const handleAgentConfigSave = useCallback((agent: Agent) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        agents: t.agents.map((a) => (a.id === agent.id ? agent : a)),
      })),
    );
  }, [setTeams]);

  const replaceAgentId = useCallback((oldId: string, newId: string) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        agents: t.agents.map((a) => (a.id === oldId ? { ...a, id: newId } : a)),
      })),
    );
  }, [setTeams]);

  const linkMemberAgent = useCallback(async (teamId: string, memberId: string, agentConfigId: string) => {
    try {
      await linkAgentToMember(teamId, memberId, agentConfigId);
    } catch {
      /* non-fatal */
    }
  }, []);

  return {
    handleAddAgent,
    handleRenameAgent,
    handleDeleteAgent,
    handleAgentConfigSave,
    replaceAgentId,
    linkMemberAgent,
  };
}
