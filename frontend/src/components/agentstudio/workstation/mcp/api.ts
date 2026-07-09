import type { MCPEntry, MCPFormData } from './mcp.types';
import { listMCPs, createMCP, updateMCP, deleteMCP } from '../../../../api/client/mcps';

export interface MCPAPIService {
  fetchAll(): Promise<MCPEntry[]>;
  create(data: MCPFormData): Promise<MCPEntry>;
  update(id: string, data: Partial<MCPEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: MCPEntry): Promise<MCPEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

function toEntry(item: { id: string; name: string; type: string; endpoint: string; config: Record<string, unknown> | null; status: string; created_at: string }): MCPEntry {
  return {
    id: item.id,
    name: item.name,
    description: (item.config && typeof item.config.description === 'string') ? item.config.description : item.name,
    type: (item.type === 'stdio' || item.type === 'sse') ? item.type : 'stdio',
    status: item.status === 'active' ? 'connected' : 'disconnected',
    version: (item.config && typeof item.config.version === 'string') ? item.config.version : 'v1.0.0',
    command: item.type === 'stdio' ? item.endpoint : '',
    url: item.type === 'sse' ? item.endpoint : '',
    createdAt: item.created_at.slice(0, 10),
  };
}

/** Real API implementation — persists changes to the backend. */
const realImpl: MCPAPIService = {
  fetchAll: async () => {
    const items = await listMCPs();
    return items.map(toEntry);
  },
  create: async (data) => {
    const item = await createMCP({
      name: data.name,
      type: data.type,
      endpoint: data.type === 'stdio' ? data.command : data.url,
      config: { description: data.description, version: data.version },
    });
    return toEntry(item);
  },
  update: async (id, data) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined) patch.type = data.type;
    if (data.command !== undefined) patch.endpoint = data.command;
    if (data.url !== undefined) patch.endpoint = data.url;
    if (data.description !== undefined || data.version !== undefined) {
      patch.config = { description: data.description, version: data.version };
    }
    await updateMCP(id, patch);
  },
  remove: async (id) => { await deleteMCP(id); },
  clone: async (item) => {
    const created = await createMCP({
      name: `${item.name.slice(0, 48)} (副本)`,
      type: item.type,
      endpoint: item.type === 'stdio' ? item.command : item.url,
      config: { description: item.description, version: item.version },
    });
    return toEntry(created);
  },
  removeBatch: async (ids) => {
    await Promise.all(Array.from(ids).map(deleteMCP));
  },
};

export const mcpAPI: MCPAPIService = realImpl;
