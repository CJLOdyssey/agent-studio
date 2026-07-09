import type { TeamMember } from '../../../../types/team';
import type { TeamEntry, TeamFormData } from './team.types';
import { listTeams, createTeam, updateTeam, deleteTeam } from '../../../../api/client/teams';

export interface TeamAPIService {
  fetchAll(): Promise<TeamEntry[]>;
  create(data: TeamFormData): Promise<TeamEntry>;
  update(id: string, data: Partial<TeamEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: TeamEntry): Promise<TeamEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

function backendToEntry(item: {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
  order?: number;
  is_expanded?: boolean;
  agents?: TeamMember[];
}): TeamEntry {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    status: (item.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    createdAt: item.created_at ? item.created_at.slice(0, 10) : '',
    agents: item.agents ?? [],
    memberCount: item.agents?.length ?? 0,
  };
}

const realImpl: TeamAPIService = {
  fetchAll: async () => {
    const items = await listTeams();
    return items.map(backendToEntry);
  },

  create: async (data) => {
    const created = await createTeam({
      name: data.name,
      description: data.description || undefined,
      status: data.status,
    });
    return backendToEntry(created);
  },

  update: async (id, data) => {
    await updateTeam(id, {
      name: data.name,
      description: data.description ?? undefined,
      status: data.status,
    });
  },

  remove: async (id) => {
    await deleteTeam(id);
  },

  clone: async (item) => {
    const created = await createTeam({
      name: `${item.name.slice(0, 60)} (副本)`,
      description: item.description || undefined,
      status: item.status,
    });
    return backendToEntry(created);
  },

  removeBatch: async (ids) => {
    await Promise.all(Array.from(ids).map((id) => deleteTeam(id)));
  },
};

export let teamAPI: TeamAPIService = realImpl;

export function setTeamAPI(api: TeamAPIService): void { teamAPI = api; }
