export interface TeamEntry {
  id: string;
  name: string;
  description: string;
  leader: string;
  memberCount: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export type TeamFormData = Omit<TeamEntry, 'id' | 'createdAt'>;
