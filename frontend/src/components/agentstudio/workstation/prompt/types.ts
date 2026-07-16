import type { GenericCrudReturn } from '../shared/useGenericCrud';

export interface PromptEntry {
  id: string;
  name: string;
  content: string;
  category: PromptCategory;
  model: string;
  status: 'active' | 'draft' | 'archived';
  version: string;
  createdAt: string;
}

export type PromptFormData = Omit<PromptEntry, 'id' | 'createdAt'>;

export type PromptCategory = '系统提示词' | '用户提示词' | '任务模板' | '角色定义';

export type PromptSortField = 'name' | 'category' | 'status';

export type CategoryFilter = 'all' | PromptCategory;

/** Data + UI state + CRUD ops for Prompt management. */
export interface PromptData extends GenericCrudReturn<PromptEntry, PromptFormData> {
  categoryFilter: CategoryFilter;
  setCategoryFilter: (v: CategoryFilter) => void;
  addPrompt: (data: PromptFormData) => void;
  updatePrompt: (id: string, data: Partial<PromptEntry>) => void;
  removePrompt: (id: string) => void;
  copyPrompt: (item: PromptEntry) => void;
  removeMultiple: (ids: Set<string>) => void;
  /** Exposed for import/export composition — returns all items (unfiltered, unsorted) */
  getAllItems: () => PromptEntry[];
  /** Exposed for import/export composition — batch-append new items */
  addItems: (newItems: PromptEntry[]) => void;
}
