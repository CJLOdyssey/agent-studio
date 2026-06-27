import type { TeamEntry, TeamFormData } from './team.types';
import { MOCK_TEAMS } from './mock-data';
import { nextId, today } from '../utils';

export interface TeamAPIService {
  fetchAll(): TeamEntry[];
  create(data: TeamFormData): TeamEntry;
  update(id: string, data: Partial<TeamEntry>): void;
  remove(id: string): void;
  clone(item: TeamEntry): TeamEntry;
  removeBatch(ids: Set<string>): void;
}

export let teamAPI: TeamAPIService = {
  fetchAll: () => MOCK_TEAMS,
  create: (data) => ({ id: nextId(MOCK_TEAMS), ...data, createdAt: today() }),
  update: (id, data) => { const i = MOCK_TEAMS.findIndex((m) => m.id === id); if (i >= 0) Object.assign(MOCK_TEAMS[i], data); },
  remove: (id) => { const i = MOCK_TEAMS.findIndex((m) => m.id === id); if (i >= 0) MOCK_TEAMS.splice(i, 1); },
  clone: (item) => ({ ...item, id: nextId(MOCK_TEAMS), name: `${item.name} (副本)`, createdAt: today() }),
  removeBatch: (ids) => { const s = new Set(ids); for (let i = MOCK_TEAMS.length - 1; i >= 0; i--) { if (s.has(MOCK_TEAMS[i].id)) MOCK_TEAMS.splice(i, 1); } },
};

export function setTeamAPI(api: TeamAPIService): void { teamAPI = api; }
