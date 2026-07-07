import type { TeamMember } from '../../../../types/team';

export interface TeamEntry {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  category: 'dev' | 'ops' | 'test';
  createdAt: string;
  agents: TeamMember[];
  memberCount: number;
}

export type TeamFormData = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
};

export type TeamCategoryFilter = 'all' | TeamEntry['category'];
