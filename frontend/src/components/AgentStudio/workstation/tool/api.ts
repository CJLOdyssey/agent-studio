import type { ToolEntry, ToolFormData } from './tool.types';
import { defineCrudModule } from '../shared/api-base';
import { listTools, createTool, updateTool, deleteTool } from '../../../../api/client/tools';

type ToolCreatePayload = {
  name: string;
  description: string;
  category: string;
  status: ToolEntry['status'];
  version: string;
  endpoint: string;
  parameters: string;
  method: string;
  headers: string;
};

function toEntry(item: { id: string; name: string; description: string; category: string; status: string; version: string; endpoint: string; parameters?: string; method?: string; headers?: string; is_builtin?: boolean; created_at: string }): ToolEntry {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    status: item.status === 'active' ? 'active' : 'disabled',
    version: item.version,
    endpoint: item.endpoint,
    is_builtin: item.is_builtin ?? false,
    method: item.method || 'GET',
    headers: item.headers || '{}',
    parameters: item.parameters || '{"type":"object","properties":{}}',
    createdAt: item.created_at.slice(0, 10),
  };
}

const { bind: toolAPI, setAPI: setToolAPI } = defineCrudModule<ToolEntry, ToolFormData>({
  fetchAll: async () => { const items = await listTools(); return items.map(toEntry); },
  create: async (data) => {
    const payload: ToolCreatePayload = {
      name: data.name, description: data.description, category: data.category,
      status: data.status, version: data.version,
      endpoint: data.endpoint, parameters: data.parameters,
      method: data.method || 'GET', headers: data.headers || '{}',
    };
    const item = await createTool(payload as unknown as Parameters<typeof createTool>[0]);
    return toEntry(item);
  },
  update: async (id, data) => { await updateTool(id, { ...data }); },
  remove: async (id) => { await deleteTool(id); },
  clone: async (item) => {
    const payload: ToolCreatePayload = {
      name: `${item.name.slice(0, 48)} (副本)`,
      description: item.description, category: item.category,
      status: item.status, version: item.version, endpoint: item.endpoint,
      parameters: item.parameters,
      method: item.method || 'GET', headers: item.headers || '{}',
    };
    const created = await createTool(payload as unknown as Parameters<typeof createTool>[0]);
    return toEntry(created);
  },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map(deleteTool)); },
});

export { toolAPI, setToolAPI };
