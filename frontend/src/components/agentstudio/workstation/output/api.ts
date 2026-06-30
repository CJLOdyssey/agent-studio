import type { OutputEntry, OutputFormData, OutputCategory } from './output.types';
import { listPrompts, createPrompt, updatePrompt, deletePrompt } from '../../../../api/client/prompts';

export interface OutputAPIService {
  fetchAll(): Promise<OutputEntry[]>;
  create(data: OutputFormData): Promise<OutputEntry>;
  update(id: string, data: Partial<OutputEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: OutputEntry): Promise<OutputEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

function toEntry(item: { id: string; name: string; content: string; category: string; version: string; created_at: string }): OutputEntry {
  return {
    id: item.id,
    name: item.name,
    content: item.content,
    category: item.category as OutputCategory,
    model: '',
    status: 'active',
    version: item.version,
    createdAt: item.created_at.slice(0, 10),
  };
}

async function fetchConstraints(): Promise<{ id: string; name: string; content: string; category: string; version: string; created_at: string }[]> {
  const all = await listPrompts();
  return all.filter(p => p.category === 'output_constraint');
}

const realImpl: OutputAPIService = {
  fetchAll: async () => { const items = await fetchConstraints(); return items.map(toEntry); },
  create: async (data) => {
    const item = await createPrompt({ name: data.name, category: 'output_constraint', content: data.content });
    return toEntry(item as { id: string; name: string; content: string; category: string; version: string; created_at: string });
  },
  update: async (id, data) => { await updatePrompt(id, { ...data }); },
  remove: async (id) => { await deletePrompt(id); },
  clone: async (item) => {
    const c = await createPrompt({ name: `${item.name.slice(0, 48)} (副本)`, category: 'output_constraint', content: item.content });
    return toEntry(c as { id: string; name: string; content: string; category: string; version: string; created_at: string });
  },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map(deletePrompt)); },
};

export const outputAPI: OutputAPIService = realImpl;
