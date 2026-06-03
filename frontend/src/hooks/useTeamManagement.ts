import { useState, useCallback, useMemo, useEffect } from 'react';
import { Bot } from 'lucide-react';
import type { Team, Agent } from '../types/devagents';
import { getAllAgents } from '../utils/agentMapper';
import api from '../api/client';

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
}

const API_BASE = '';

async function fetchTeams(): Promise<Team[]> {
  try {
    const res = await fetch(`${API_BASE}/api/teams`);
    if (!res.ok) return [];
    const data: ApiTeam[] = await res.json();
    return data.map(t => ({
      id: t.id,
      name: t.name,
      isExpanded: t.is_expanded,
      agents: t.agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        icon: Bot,
        color: 'text-[var(--da-text-muted)]',
        bg: 'bg-[var(--da-bg-surface)]',
        border: 'border-[var(--da-border)]',
      })),
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

  const toggleTeam = useCallback(async (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;
    const newExpanded = !team.isExpanded;
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, isExpanded: newExpanded } : t));
    await apiPut(`/api/teams/${teamId}`, { is_expanded: newExpanded }).catch(() => {});
  }, [teams]);

  const handleAddTeam = useCallback(async () => {
    try {
      const res = await apiPost('/api/teams', { name: '新团队' });
      setTeams(prev => [...prev, { id: res.id, name: res.name, isExpanded: false, agents: [] }]);
      toast?.('团队已创建', 'success');
    } catch {
      toast?.('创建团队失败', 'error');
    }
  }, [toast]);

  const handleAddAgent = useCallback(async (teamId: string) => {
    try {
      const member = await apiPost(`/api/teams/${teamId}/members`, { name: '新 Agent' });
      const newAgent: Agent = {
        id: member.id, name: member.name, role: member.role || '待配置角色',
        icon: Bot, color: 'text-[var(--da-text-muted)]',
        bg: 'bg-[var(--da-bg-surface)]', border: 'border-[var(--da-border)]',
      };
      setTeams(prev => prev.map(t =>
        t.id === teamId ? { ...t, isExpanded: true, agents: [...t.agents, newAgent] } : t,
      ));
      toast?.('Agent 已添加', 'success');
    } catch {
      toast?.('添加 Agent 失败', 'error');
    }
  }, [toast]);

  const startEditTeam = useCallback((team: Team) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
  }, []);

  const saveEditTeam = useCallback(async () => {
    if (!editingTeamId) return;
    const name = editTeamName.trim();
    if (!name) return;
    setTeams(prev => prev.map(t => t.id === editingTeamId ? { ...t, name } : t));
    setEditingTeamId(null);
    setEditTeamName('');
    await apiPut(`/api/teams/${editingTeamId}`, { name }).catch(() => {});
  }, [editingTeamId, editTeamName]);

  const cancelEditTeam = useCallback(() => {
    setEditingTeamId(null);
    setEditTeamName('');
  }, []);

  const handleRename = useCallback((teamId: string, name: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, name } : t));
    apiPut(`/api/teams/${teamId}`, { name }).catch(() => {});
  }, []);

  const handleDeleteTeam = useCallback(async (teamId: string) => {
    setTeams(prev => prev.filter(t => t.id !== teamId));
    await apiDelete(`/api/teams/${teamId}`).catch(() => {});
    toast?.('团队已删除', 'info');
  }, [toast]);

  const handleDeleteAgent = useCallback(async (teamId: string, agentId: string) => {
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, agents: t.agents.filter(a => a.id !== agentId) } : t,
    ));
    await apiDelete(`/api/teams/${teamId}/members/${agentId}`).catch(() => {});
  }, []);

  const allAgents = useMemo(() => getAllAgents(teams), [teams]);

  const saveTeamName = useCallback(() => saveEditTeam(), [saveEditTeam]);

  const handleTeamNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { saveEditTeam(); }
    if (e.key === 'Escape') { cancelEditTeam(); }
  }, [saveEditTeam, cancelEditTeam]);

  const handleAgentConfigSave = useCallback((agent: Agent) => {
    setTeams(prev => prev.map(t => ({
      ...t,
      agents: t.agents.map(a => a.id === agent.id ? agent : a),
    })));
  }, []);

  return {
    teams, editingTeamId, editTeamName, setEditTeamName,
    toggleTeam, handleAddTeam, handleAddAgent,
    startEditTeam, saveEditTeam, cancelEditTeam,
    saveTeamName, handleTeamNameKeyDown,
    handleRename, handleDeleteTeam, handleDeleteAgent,
    handleAgentConfigSave, allAgents,
  };
}
