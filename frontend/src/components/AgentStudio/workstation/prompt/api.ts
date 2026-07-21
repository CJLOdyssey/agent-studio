import type { PromptEntry, PromptFormData, PromptCategory } from './types';
import { listPrompts, createPrompt, updatePrompt, deletePrompt } from '../../../../api/client/prompts';

export interface PromptAPIService {
  fetchAll(): Promise<PromptEntry[]>;
  create(data: PromptFormData): Promise<PromptEntry>;
  update(id: string, data: Partial<PromptEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: PromptEntry): Promise<PromptEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

function toEntry(item: { id: string; name: string; category: string; content: string; model: string | null; status: string; version: string; created_at: string }): PromptEntry {
  return {
    id: item.id,
    name: item.name,
    content: item.content,
    category: item.category as PromptCategory,
    model: item.model ?? '',
    status: (item.status === 'active' ? 'active' : 'draft') as 'active' | 'draft' | 'archived',
    version: item.version,
    createdAt: item.created_at.slice(0, 10),
  };
}

const realImpl: PromptAPIService = {
  fetchAll: async () => { const items = await listPrompts(); return items.map(toEntry); },
  create: async (data) => { const item = await createPrompt({ name: data.name, category: data.category, content: data.content }); return toEntry(item); },
  update: async (id, data) => { await updatePrompt(id, { ...data }); },
  remove: async (id) => { await deletePrompt(id); },
  clone: async (item) => { const c = await createPrompt({ name: `${item.name.slice(0, 48)} (副本)`, category: item.category, content: item.content }); return toEntry(c); },
  removeBatch: async (ids) => { await Promise.all(Array.from(ids).map(deletePrompt)); },
};

export let promptAPI: PromptAPIService = realImpl;

export function setPromptAPI(api: PromptAPIService): void { promptAPI = api; }
