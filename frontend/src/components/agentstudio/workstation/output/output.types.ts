export type OutputCategory = '格式约束' | '内容约束' | '语言约束' | '长度约束';
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
