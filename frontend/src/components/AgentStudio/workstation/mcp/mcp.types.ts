import type { GenericCrudReturn } from '../shared/useGenericCrud';

export interface MCPEntry {
  id: string;
  name: string;
  description: string;
  type: 'stdio' | 'sse';
  status: 'connected' | 'disconnected' | 'error';
  version: string;
  command: string;
  url: string;
  createdAt: string;
}

export type MCPFormData = Omit<MCPEntry, 'id' | 'createdAt'>;

export interface MCPData extends GenericCrudReturn<MCPEntry, MCPFormData> {
  typeFilter: string;
  statusFilter: string;
  setTypeFilter: (v: string) => void;
  setStatusFilter: (v: string) => void;
  addMCP: (data: MCPFormData) => Promise<void>;
  updateMCP: (id: string, data: Partial<MCPEntry>) => Promise<void>;
  removeMCP: (id: string) => Promise<void>;
  copyMCP: (item: MCPEntry) => Promise<void>;
  removeMultiple: (ids: Set<string>) => Promise<void>;
}
