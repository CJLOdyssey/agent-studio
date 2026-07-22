import type { OutputEntry, OutputFormData, OutputCategory } from './output.types';
import { defineCrudModule } from '../shared/api-base';
import { listPrompts, createPrompt, updatePrompt, deletePrompt } from '../../../../api/client/prompts';

interface PromptRow {
  id: string; name: string; content: string; category: string;
  model: string | null; version: string; created_at: string;
}

function toEntry(item: PromptRow): OutputEntry {
  return {
    id: item.id,
    name: item.name,
    content: item.content,
    category: (item.model || item.category) as OutputCategory,
    model: '',
    status: 'active',
    version: item.version,
    createdAt: item.created_at.slice(0, 10),
  };
}

async function fetchConstraints(): Promise<PromptRow[]> {
  const all = await listPrompts();
  return all.filter(p => p.category === 'output_constraint');
}

const { bind: outputAPI, setAPI: setOutputAPI } = defineCrudModule<OutputEntry, OutputFormData>({
  fetchAll: async () => { const items = await fetchConstraints(); return items.map(toEntry); },
  create: async (data) => {
    const item = await createPrompt({ name: data.name, category: 'output_constraint', content: data.content, model: data.category });
    return toEntry(item as PromptRow);
  },
  update: async (id, data) => {
    await updatePrompt(id, {
      ...(data.name ? { name: data.name } : {}),
      ...(data.content ? { content: data.content } : {}),
      ...(data.category ? { model: data.category } : {}),
    });
  },
  remove: async (id) => { await deletePrompt(id); },
  clone: async (item) => {
    const c = await createPrompt({ name: `${item.name.slice(0, 48)} (副本)`, category: 'output_constraint', content: item.content, model: item.category });
    return toEntry(c as PromptRow);
  },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map(deletePrompt)); },
});

export { outputAPI, setOutputAPI };
