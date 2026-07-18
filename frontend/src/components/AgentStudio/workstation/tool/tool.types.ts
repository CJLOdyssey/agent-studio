import type { GenericCrudReturn } from '../shared/useGenericCrud';

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

export interface ToolData extends GenericCrudReturn<ToolEntry, ToolFormData> {
  categoryFilter: string;
  statusFilter: string;
  setCategoryFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  addTool: (data: ToolFormData) => Promise<void>;
  updateTool: (id: string, data: Partial<ToolEntry>) => Promise<void>;
  removeTool: (id: string) => Promise<void>;
  copyTool: (item: ToolEntry) => Promise<void>;
  removeMultiple: (ids: Set<string>) => Promise<void>;
}
