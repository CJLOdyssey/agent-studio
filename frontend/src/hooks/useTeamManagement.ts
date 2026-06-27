import { useState, useCallback, useMemo, useEffect } from 'react';
import { Bot } from 'lucide-react';
import type { Team, Agent } from '../types/devagents';
import { getAllAgents } from '../utils/agentMapper';
import { validateName, checkTeamLimit, checkAgentLimit } from '../utils/validation';
import api from '../api/client';

const STORAGE_KEY = 'devagents-conversations';

function removeConversationsByAgentIds(agentIds: string[]) {
  if (!agentIds.length) return;
  try {
    const existing: Array<{ agentId?: string; [k: string]: unknown }> =
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = existing.filter((c) => !c.agentId || !agentIds.includes(c.agentId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('devagents-conversations-updated'));
  } catch { /* non-fatal */ }
}

type ToastFn = (msg: string, type: 'success' | 'info' | 'error') => void;

interface ApiTeam {
  id: string;
  name: string;
  order: number;
  is_expanded: boolean;
  agents: ApiTeamMember[];
}

interface ApiTeamMember {
  id: string;
  name: string;
  role: string;
  order: number;
  agent_config_id: string | null;
  system_prompt: string | null;
  output_constraints: string | null;
  tools?: { name: string; enabled?: boolean }[] | string;
  mcp?: { name: string; enabled?: boolean }[] | string;
  skills?: { name: string; enabled?: boolean }[] | string;
}

async function fetchTeams(): Promise<Team[]> {
  try {
    const res = await api.get('/teams');
    const data: ApiTeam[] = res.data;
    return data.map((t) => ({
      id: t.id,
      name: t.name,
      isExpanded: t.is_expanded,
      isPinned: false,
      agents: t.agents.map((a) => {
        const parseJsonArray = (val: unknown): { name: string; enabled?: boolean }[] => {
          if (Array.isArray(val)) return val;
          if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
          return [];
        };
        return {
          id: a.agent_config_id || a.id,
          name: a.name,
          role: a.role,
          systemPrompt: a.system_prompt || undefined,
          outputConstraints: a.output_constraints || undefined,
          tools: parseJsonArray(a.tools).map((t: { name: string; enabled?: boolean }) => ({ id: t.name, name: t.name, description: '', enabled: t.enabled ?? true })),
          mcp: parseJsonArray(a.mcp).map((m: { name: string; enabled?: boolean }) => ({ id: m.name, name: m.name, description: '', serverUrl: '', enabled: m.enabled ?? true })),
          skills: parseJsonArray(a.skills).map((s: { name: string; enabled?: boolean }) => ({ id: s.name, name: s.name, description: '', enabled: s.enabled ?? true })),
          icon: Bot,
          color: 'text-[var(--da-text-muted)]',
          bg: 'bg-[var(--da-bg-surface)]',
          border: 'border-[var(--da-border)]',
        };
      }),
    }));
  } catch {
    return [];
  }
}

async function apiPost(url: string, data: unknown) {
  const res = await api.post(url, data);
  return res.data;
}

async function apiPut(url: string, data: unknown) {
  await api.put(url, data);
}

async function apiDelete(url: string) {
  await api.delete(url);
}

export function useTeamManagement(toast?: ToastFn) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');

  useEffect(() => {
    fetchTeams().then(setTeams);
  }, []);

  const toggleTeam = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team) return;
      const newExpanded = !team.isExpanded;
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, isExpanded: newExpanded } : t)));
      await apiPut(`/teams/${teamId}`, { is_expanded: newExpanded }).catch(() => {});
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
      const res = await apiPost('/teams', { name: teamName });
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
        const member = await apiPost(`/teams/${teamId}/members`, { name: agentName });
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
    await apiPut(`/teams/${editingTeamId}`, { name }).catch(() => {});
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
    apiPut(`/teams/${teamId}`, { name: trimmed }).catch(() => {});
  }, [teams, toast]);

  const handleRenameAgent = useCallback((agentId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // 查找 Agent 所在团队，验证同团队内不重名
    let existingNames: string[] = [];
    teams.forEach((team) => {
      if (team.agents.some((a) => a.id === agentId)) {
        existingNames = team.agents.filter((a) => a.id !== agentId).map((a) => a.name);
      }
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
    apiPut(`/agents/${agentId}`, { name: trimmed }).catch(() => {});
  }, [teams, toast]);

  const handleDeleteTeam = useCallback(
    async (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      const agentIds = team?.agents.map((a) => a.id) ?? [];
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      removeConversationsByAgentIds(agentIds);
      await apiDelete(`/teams/${teamId}`).catch(() => {});
      toast?.('团队已删除', 'info');
    },
    [toast, teams],
  );

  const handleDeleteAgent = useCallback(async (teamId: string, agentId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, agents: t.agents.filter((a) => a.id !== agentId) } : t)),
    );
    removeConversationsByAgentIds([agentId]);
    await apiDelete(`/teams/${teamId}/members/${agentId}`).catch(() => {});
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
