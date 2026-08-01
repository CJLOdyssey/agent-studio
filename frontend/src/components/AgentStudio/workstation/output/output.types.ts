export type OutputCategory = string;
export type OutputSortField = 'name' | 'category' | 'status';

export interface OutputEntry {
  id: string;
  name: string;
  content: string;
  category: OutputCategory;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
}

export type OutputFormData = Omit<OutputEntry, 'id' | 'createdAt'>;
