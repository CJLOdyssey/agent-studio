import type { MCPEntry, MCPFormData } from './mcp.types';
import { defineCrudModule } from '../shared/api-base';
import { listMCPs, createMCP, updateMCP, deleteMCP } from '../../../../api/client/mcps';

function parseConfig(raw: string | Record<string, unknown> | null): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

function toEntry(item: { id: string; name: string; type: string; endpoint: string; config: string | Record<string, unknown> | null; status: string; created_at: string }): MCPEntry {
  const cfg = parseConfig(item.config);
  return {
    id: item.id,
    name: item.name,
    description: typeof cfg.description === 'string' ? cfg.description : item.name,
    type: (item.type === 'stdio' || item.type === 'sse') ? item.type : 'stdio',
    status: item.status === 'active' ? 'connected' : 'disconnected',
    version: typeof cfg.version === 'string' ? cfg.version : 'v1.0.0',
    command: item.type === 'stdio' ? item.endpoint : '',
    url: item.type === 'sse' ? item.endpoint : '',
    createdAt: item.created_at.slice(0, 10),
  };
}

const { bind: mcpAPI, setAPI: setMCPAPI } = defineCrudModule<MCPEntry, MCPFormData>({
  fetchAll: async () => { const items = await listMCPs(); return items.map(toEntry); },
  create: async (data) => {
    const item = await createMCP({
      name: data.name, type: data.type,
      endpoint: data.type === 'stdio' ? data.command : data.url,
      config: JSON.stringify({ description: data.description, version: data.version }),
    });
    return toEntry(item);
  },
  update: async (id, data) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined) patch.type = data.type;
    if (data.type === 'stdio' && data.command !== undefined) {
      patch.endpoint = data.command;
    } else if (data.type === 'sse' && data.url !== undefined) {
      patch.endpoint = data.url;
    } else if (data.type === undefined) {
      if (data.command !== undefined) patch.endpoint = data.command;
      if (data.url !== undefined) patch.endpoint = data.url;
    }
    if (data.description !== undefined || data.version !== undefined) {
      patch.config = JSON.stringify({ description: data.description, version: data.version });
    }
    await updateMCP(id, patch);
  },
  remove: async (id) => { await deleteMCP(id); },
  clone: async (item) => {
    const created = await createMCP({
      name: `${item.name.slice(0, 48)} (副本)`, type: item.type,
      endpoint: item.type === 'stdio' ? item.command : item.url,
      config: JSON.stringify({ description: item.description, version: item.version }),
    });
    return toEntry(created);
  },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map(deleteMCP)); },
});

export { mcpAPI, setMCPAPI };
