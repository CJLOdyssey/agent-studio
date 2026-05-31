import { useState, useCallback } from 'react';
import { Bot } from 'lucide-react';
import type { Team, Agent } from '../types/devagents';
import { INITIAL_TEAMS } from '../constants/initialTeams';

type ToastFn = (msg: string, type: 'success' | 'info' | 'error') => void;

export function useTeamManagement(toast?: ToastFn) {
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState('');

  const toggleTeam = useCallback((teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, isExpanded: !t.isExpanded } : t));
  }, []);

  const handleAddTeam = useCallback(() => {
    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: `新团队 ${teams.length + 1}`,
      isExpanded: true,
      agents: []
    };
    setTeams(prev => [...prev, newTeam]);
    toast?.('团队已创建', 'success');
  }, [teams.length, toast]);

  const handleAddAgent = useCallback((teamId: string) => {
    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      name: `新 Agent`,
      role: '待配置角色',
      icon: Bot,
      color: 'text-[var(--da-text-muted)]',
      bg: 'bg-[var(--da-bg-surface)]',
      border: 'border-[var(--da-border)]'
    };
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, agents: [...t.agents, newAgent] } : t
    ));
    toast?.('Agent 已添加', 'success');
  }, [toast]);

  const startEditTeam = useCallback((team: Team) => {
    setEditingTeamId(team.id);
    setEditTeamName(team.name);
  }, []);

  const saveTeamName = useCallback((teamId: string) => {
    if (editTeamName.trim()) {
      setTeams(prev => prev.map(t =>
        t.id === teamId ? { ...t, name: editTeamName.trim() } : t
      ));
      toast?.('团队已重命名', 'success');
    }
    setEditingTeamId(null);
  }, [editTeamName, toast]);

  const handleTeamNameKeyDown = useCallback((e: React.KeyboardEvent, teamId: string) => {
    if (e.key === 'Enter') saveTeamName(teamId);
    else if (e.key === 'Escape') setEditingTeamId(null);
  }, [saveTeamName]);

  const handleDeleteTeam = useCallback((teamId: string) => {
    setTeams(prev => prev.filter(t => t.id !== teamId));
    toast?.('团队已删除', 'success');
  }, [toast]);

  const handleDeleteAgent = useCallback((teamId: string, agentId: string) => {
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, agents: t.agents.filter(a => a.id !== agentId) } : t
    ));
    toast?.('Agent 已删除', 'success');
  }, [toast]);

  const handleAgentConfigSave = useCallback((updatedAgent: Agent) => {
    setTeams(prev => prev.map(t => ({
      ...t,
      agents: t.agents.map(a => a.id === updatedAgent.id ? updatedAgent : a)
    })));
  }, []);

  const allAgents = teams.flatMap(t => t.agents);

  return {
    teams, setTeams,
    editingTeamId, setEditingTeamId,
    editTeamName, setEditTeamName,
    allAgents,
    toggleTeam, handleAddTeam, handleAddAgent,
    startEditTeam, saveTeamName, handleTeamNameKeyDown,
    handleDeleteTeam, handleDeleteAgent, handleAgentConfigSave,
  };
}
