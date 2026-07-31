export type OutputCategory = string;
export type OutputSortField = 'name' | 'category' | 'status';

export interface OutputEntry {
  id: string;
  name: string;
  content: string;
  category: OutputCategory;
  model: string;
  status: 'active' | 'draft' | 'archived';
  version: string;
  createdAt: string;
}

export type OutputFormData = Omit<OutputEntry, 'id' | 'createdAt'>;
