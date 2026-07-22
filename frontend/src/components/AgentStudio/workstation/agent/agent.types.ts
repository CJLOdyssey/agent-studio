export interface AgentEntry {
  id: string;
  name: string;
  description: string;
  team: string;
  teams: string[];
  model: string;
  status: 'running' | 'stopped' | 'error';
  version: string;
  systemPromptId: string;
  toolIds: string[];
  mcpIds: string[];
  skillIds: string[];
  createdAt: string;
}

export type AgentFormData = Omit<AgentEntry, 'id' | 'createdAt' | 'teams'>;

export type SortField = 'name' | 'team' | 'status';
export type StatusFilter = 'all' | AgentEntry['status'];
