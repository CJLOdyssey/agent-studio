import type { TeamMember } from '../../../../types/team';
import type { GenericCrudReturn } from '../shared/useGenericCrud';

export interface TeamEntry {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'disabled';
  category: string;
  createdAt: string;
  agents: TeamMember[];
  memberCount: number;
}

export type TeamFormData = {
  name: string;
  description: string;
  status: 'active' | 'disabled';
  category: string;
};

export type TeamCategoryFilter = 'all' | string;

export interface TeamData extends GenericCrudReturn<TeamEntry, TeamFormData> {
  teams: TeamEntry[];
  categoryFilter: TeamCategoryFilter;
  statusFilter: 'all' | TeamEntry['status'];
  sortField: 'name' | 'status';
  setCategoryFilter: (v: TeamCategoryFilter) => void;
  setStatusFilter: (v: 'all' | TeamEntry['status']) => void;
  addTeam: (data: TeamFormData) => Promise<TeamEntry | undefined>;
  updateTeam: (id: string, data: Partial<TeamFormData>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  batchDelete: (ids: Set<string>) => Promise<void>;
}
