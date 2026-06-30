export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  model: string;
  status: 'active' | 'disabled';
  version: string;
  endpoint: string;
  parameters: string;
  createdAt: string;
}

export type ToolFormData = Omit<ToolEntry, 'id' | 'createdAt'>;
