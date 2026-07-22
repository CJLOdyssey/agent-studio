import api from './instance';
import type { TeamMember } from '../../types/team';

export interface TeamItem {
  id: string;
  name: string;
  order: number;
  is_expanded: boolean;
  agents: TeamMember[];
  created_at: string | null;
  description?: string | null;
  status?: string | null;
}

export async function listTeams(): Promise<TeamItem[]> {
  const { data } = await api.get('/teams');
  return data;
}

export async function createTeam(payload: { name: string; description?: string; status?: string }): Promise<TeamItem> {
  const { data } = await api.post('/teams', payload);
  return data;
}

export async function updateTeam(
  id: string,
  payload: { name?: string; description?: string; status?: string; order?: number; is_expanded?: boolean },
): Promise<TeamItem> {
  const { data } = await api.put(`/teams/${id}`, payload);
  return data;
}

export async function deleteTeam(id: string): Promise<void> {
  await api.delete(`/teams/${id}`);
}

export async function addTeamMember(
  teamId: string,
  payload: { name: string; role?: string; agent_config_id?: string },
): Promise<TeamMember> {
  const { data } = await api.post(`/teams/${teamId}/members`, payload);
  return data;
}

export async function removeTeamMember(teamId: string, memberId: string): Promise<void> {
  await api.delete(`/teams/${teamId}/members/${memberId}`);
}

export async function linkAgentToMember(teamId: string, memberId: string, agentConfigId: string): Promise<void> {
  await api.put(`/teams/${teamId}/members/${memberId}/link-agent`, { agent_config_id: agentConfigId });
}
