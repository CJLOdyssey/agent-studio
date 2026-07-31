import type { TeamMember } from '../../../../types/team';
import type { TeamEntry, TeamFormData } from './team.types';
import { defineCrudModule } from '../shared/api-base';
import { listTeams, createTeam, updateTeam, deleteTeam } from '../../../../api/client/teams';

function backendToEntry(item: {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  category?: string | null;
  created_at?: string | null;
  order?: number;
  is_expanded?: boolean;
  agents?: TeamMember[];
}): TeamEntry {
  return {
    id: item.id,
    name: item.name,
    description: item.description || '',
    status: (item.status === 'inactive' || item.status === 'disabled' ? 'disabled' : 'active') as 'active' | 'disabled',
    category: item.category || '',
    createdAt: item.created_at ? item.created_at.slice(0, 10) : '',
    agents: item.agents ?? [],
    memberCount: item.agents?.length ?? 0,
  };
}

const { bind: teamAPI, setAPI: setTeamAPI } = defineCrudModule<TeamEntry, TeamFormData>({
  fetchAll: async () => { const items = await listTeams(); return items.map(backendToEntry); },
  create: async (data) => {
    const created = await createTeam({ name: data.name, description: data.description || undefined, status: data.status, category: data.category });
    return backendToEntry(created);
  },
  update: async (id, data) => { await updateTeam(id, { name: data.name, description: data.description ?? undefined, status: data.status, category: data.category }); },
  remove: async (id) => { await deleteTeam(id); },
  clone: async (item) => {
    const created = await createTeam({ name: `${item.name.slice(0, 60)} (副本)`, description: item.description || undefined, status: item.status, category: item.category });
    return backendToEntry(created);
  },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map((id) => deleteTeam(id))); },
});

export { teamAPI, setTeamAPI };
