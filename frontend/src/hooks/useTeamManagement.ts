import { useState, useCallback, useEffect, useMemo } from 'react';
import { Bot } from 'lucide-react';
import type { Team, Agent } from '../types/agentstudio';
import type { TeamMember } from '../types/team';
import { getAllAgents } from '../utils/agentMapper';
import { validateName, checkTeamLimit, checkAgentLimit } from '../utils/validation';
import { listTeams, createTeam, updateTeam, deleteTeam } from '../api/client/teams';
import { updateAgent } from '../api/client/agents';
import api from '../api/client';
const STORAGE_KEY = 'agentstudio-conversations';

function removeConversationsByAgentIds(agentIds: string[]) {
  if (!agentIds.length) return;
  try {
    const existing: Array<{ agentId?: string; [k: string]: unknown }> =
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = existing.filter((c) => !c.agentId || !agentIds.includes(c.agentId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('agentstudio-conversations-updated'));
  } catch { /* non-fatal */ }
}

type ToastFn = (msg: string, type: 'success' | 'info' | 'error') => void;

function teamMemberToAgent(a: TeamMember): Agent {
  const parseJsonArray = (val: unknown): { name: string; enabled?: boolean }[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
    return [];
  };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    id: (a as any).agent_config_id || a.agentConfigId || a.id,
    name: a.name,
    role: a.role,
    systemPrompt: (a as any).system_prompt || a.systemPrompt || undefined,
    outputConstraints: (a as any).output_constraints || a.outputConstraints || undefined,
    tools: parseJsonArray(a.tools).map((t: { name: string; enabled?: boolean }) => ({ id: t.name, name: t.name, description: '', enabled: t.enabled ?? true })),
    mcp: parseJsonArray(a.mcp).map((m: { name: string; enabled?: boolean }) => ({ id: m.name, name: m.name, description: '', serverUrl: '', enabled: m.enabled ?? true })),
    skills: parseJsonArray(a.skills).map((s: { name: string; enabled?: boolean }) => ({ id: s.name, name: s.name, description: '', enabled: s.enabled ?? true })),
    icon: Bot,
    color: 'text-[var(--da-text-muted)]',
    bg: 'bg-[var(--da-bg-surface)]',
    border: 'border-[var(--da-border)]',
  };
}

async function fetchTeams(): Promise<Team[]> {
  try {
    const items = await listTeams();
    return items.map((t) => ({
      id: t.id,
      name: t.name,
      isExpanded: t.is_expanded,
      isPinned: false,
      agents: (t.agents ?? []).map(teamMemberToAgent),
    }));
  } catch {
    return [];
  }
}

export function useTeamManagement(toast?: ToastFn) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchTeams().then(setTeams);
  }, [refreshKey]);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener('auth:login', handler);
    window.addEventListener('auth:logout', handler);
    return () => {
      window.removeEventListener('auth:login', handler);
      window.removeEventListener('auth:logout', handler);
    };
  }, []);

  const toggleTeam = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;
      const newExpanded = !team.isExpanded;
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, isExpanded: newExpanded } : t)));
      await updateTeam(teamId, { is_expanded: newExpanded }).catch(() => {});
    },
    [teams],
  );

  const handleAddTeam = useCallback(async () => {
    // 团队数量上限检查
    const limitCheck = checkTeamLimit(teams.length);
    if (!limitCheck.valid) {
      toast?.(limitCheck.error!, 'error');
      return;
    }

    // 生成唯一的团队名称
    let teamName = '新团队';
    const existingNames = teams.map((t) => t.name);
    if (existingNames.includes(teamName)) {
      let counter = 2;
      while (existingNames.includes(`${teamName} (${counter})`)) {
        counter++;
      }
      teamName = `${teamName} (${counter})`;
    }

    try {
      const res = await createTeam({ name: teamName });
      setTeams((prev) => [...prev, { id: res.id, name: res.name, isExpanded: false, isPinned: false, agents: [] }]);
      toast?.('团队已创建', 'success');
    } catch {
      toast?.('创建团队失败', 'error');
    }
  }, [teams, toast]);

  const handleAddAgent = useCallback(
    async (teamId: string) => {
      // 每团队 Agent 数量上限检查
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;

      const limitCheck = checkAgentLimit(team.agents.length);
      if (!limitCheck.valid) {
        toast?.(limitCheck.error!, 'error');
        return;
      }

      // 生成唯一的 Agent 名称
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
        const member = (await api.post(`/api/teams/${teamId}/members`, { name: agentName })).data;
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
    [teams, toast],
  );

  const startEditTeam = useCallback((team: Team) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
  }, []);

  const saveEditTeam = useCallback(async () => {
    if (!editingTeamId) return;
    const name = editTeamName.trim();
    if (!name) {
      toast?.('名称不能为空', 'error');
      return;
    }
    // 名称验证（去重、长度、特殊字符、保留字）
    const existingNames = teams.filter((t) => t.id !== editingTeamId).map((t) => t.name);
    const validation = validateName(name, existingNames);
    if (!validation.valid) {
      toast?.(validation.error!, 'error');
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === editingTeamId ? { ...t, name } : t)));
    setEditingTeamId(null);
    setEditTeamName('');
    await updateTeam(editingTeamId, { name }).catch(() => {});
  }, [editingTeamId, editTeamName, teams, toast]);

  const cancelEditTeam = useCallback(() => {
    setEditingTeamId(null);
    setEditTeamName('');
  }, []);

  const handleRename = useCallback((teamId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existingNames = teams.filter((t) => t.id !== teamId).map((t) => t.name);
    const validation = validateName(trimmed, existingNames);
    if (!validation.valid) {
      toast?.(validation.error!, 'error');
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name: trimmed } : t)));
    updateTeam(teamId, { name: trimmed }).catch(() => {});
  }, [teams, toast]);

  const handleRenameAgent = useCallback((agentId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // 查找 Agent 所在团队，验证同团队内不重名
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
  }, [teams, toast]);

  const handleDeleteTeam = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      const agentIds = team?.agents.map((a) => a.id) ?? [];
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      removeConversationsByAgentIds(agentIds);
      await deleteTeam(teamId).catch(() => {});
      toast?.('团队已删除', 'info');
    },
    [toast, teams],
  );

  const handleDeleteAgent = useCallback(async (teamId: string, agentId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, agents: t.agents.filter((a) => a.id !== agentId) } : t)),
    );
    removeConversationsByAgentIds([agentId]);
    await api.delete(`/api/teams/${teamId}/members/${agentId}`).catch(() => {});
  }, []);

  const handleTogglePinTeam = useCallback((teamId: string) => {
    setTeams((prev) => {
      const team = prev.find((t) => t.id === teamId);
      if (!team) return prev;
      
      const newTeams = prev.map((t) => 
        t.id === teamId ? { ...t, isPinned: !t.isPinned } : t
      );
      
      return newTeams.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    });
  }, []);

  const allAgents = useMemo(() => getAllAgents(teams), [teams]);

  const saveTeamName = useCallback(() => saveEditTeam(), [saveEditTeam]);

  const handleTeamNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        saveEditTeam();
      }
      if (e.key === 'Escape') {
        cancelEditTeam();
      }
    },
    [saveEditTeam, cancelEditTeam],
  );

  const handleAgentConfigSave = useCallback((agent: Agent) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        agents: t.agents.map((a) => (a.id === agent.id ? agent : a)),
      })),
    );
  }, []);

  const replaceAgentId = useCallback((oldId: string, newId: string) => {
    setTeams((prev) =>
      prev.map((t) => ({
        ...t,
        agents: t.agents.map((a) => (a.id === oldId ? { ...a, id: newId } : a)),
      })),
    );
  }, []);

  const linkMemberAgent = useCallback(async (teamId: string, memberId: string, agentConfigId: string) => {
    try {
      await api.put(`/teams/${teamId}/members/${memberId}/link-agent`, { agent_config_id: agentConfigId });
    } catch {
      /* non-fatal */
    }
  }, []);

  return {
    teams,
    editingTeamId,
    editTeamName,
    setEditTeamName,
    toggleTeam,
    handleAddTeam,
    handleAddAgent,
    startEditTeam,
    saveEditTeam,
    cancelEditTeam,
    saveTeamName,
    handleTeamNameKeyDown,
    handleRename,
    handleRenameAgent,
    handleDeleteTeam,
    handleDeleteAgent,
    handleTogglePinTeam,
    handleAgentConfigSave,
    replaceAgentId,
    linkMemberAgent,
    allAgents,
  };
}
