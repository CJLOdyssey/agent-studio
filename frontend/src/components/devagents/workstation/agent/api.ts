import type { AgentEntry, AgentFormData } from './agent.types';
import { MOCK_AGENTS } from './mock-data';
import { nextId, today } from '../utils';

export interface AgentAPIService {
  fetchAll(): AgentEntry[];
  create(data: AgentFormData): AgentEntry;
  update(id: string, data: Partial<AgentEntry>): void;
  remove(id: string): void;
  clone(item: AgentEntry): AgentEntry;
  removeBatch(ids: Set<string>): void;
}

export let agentAPI: AgentAPIService = {
  fetchAll: () => MOCK_AGENTS,
  create: (data) => ({ id: nextId(MOCK_AGENTS), ...data, createdAt: today() }),
  update: (id, data) => { const i = MOCK_AGENTS.findIndex((m) => m.id === id); if (i >= 0) Object.assign(MOCK_AGENTS[i], data); },
  remove: (id) => { const i = MOCK_AGENTS.findIndex((m) => m.id === id); if (i >= 0) MOCK_AGENTS.splice(i, 1); },
  clone: (item) => ({ ...item, id: nextId(MOCK_AGENTS), name: `${item.name.slice(0, 28)} (副本)`, createdAt: today() }),
  removeBatch: (ids) => { const s = new Set(ids); for (let i = MOCK_AGENTS.length - 1; i >= 0; i--) { if (s.has(MOCK_AGENTS[i].id)) MOCK_AGENTS.splice(i, 1); } },
};

export function setAgentAPI(api: AgentAPIService): void { agentAPI = api; }
