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
