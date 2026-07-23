import type { ToolEntry, ToolFormData } from './tool.types';
import { defineCrudModule } from '../shared/api-base';
import { listTools, createTool, updateTool, deleteTool } from '../../../../api/client/tools';

function toEntry(item: { id: string; name: string; description: string; category: string; model: string | null; status: string; version: string; endpoint: string; parameters?: string; created_at: string }): ToolEntry {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    model: item.model ?? '',
    status: item.status === 'active' ? 'active' : 'disabled',
    version: item.version,
    endpoint: item.endpoint,
    parameters: item.parameters || '{"type":"object","properties":{}}',
    createdAt: item.created_at.slice(0, 10),
  };
}

const { bind: toolAPI, setAPI: setToolAPI } = defineCrudModule<ToolEntry, ToolFormData>({
  fetchAll: async () => { const items = await listTools(); return items.map(toEntry); },
  create: async (data) => {
    const item = await createTool({
      name: data.name, description: data.description, category: data.category,
      model: data.model, status: data.status, version: data.version,
      endpoint: data.endpoint, parameters: data.parameters,
    });
    return toEntry(item);
  },
  update: async (id, data) => { await updateTool(id, { ...data }); },
  remove: async (id) => { await deleteTool(id); },
  clone: async (item) => {
    const created = await createTool({
      name: `${item.name.slice(0, 48)} (副本)`,
      description: item.description, category: item.category, model: item.model,
      status: item.status, version: item.version, endpoint: item.endpoint,
      parameters: item.parameters,
    });
    return toEntry(created);
  },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map(deleteTool)); },
});

export { toolAPI, setToolAPI };
