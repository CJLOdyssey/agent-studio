import type { SortDir } from '../types';

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

export type PromptCategory = '系统' | '自定义' | '模板';

export type PromptSortField = 'name' | 'category' | 'status';

export type CategoryFilter = 'all' | PromptCategory;

export interface PromptData {
  isLoading: boolean;
  paged: PromptEntry[];
  processed: PromptEntry[];
  page: number;
  totalPages: number;
  search: string;
  categoryFilter: CategoryFilter;
  sortField: PromptSortField | null;
  sortDir: SortDir;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  error: string | null;
  setSearch: (v: string) => void;
  setCategoryFilter: (v: CategoryFilter) => void;
  setPage: (v: number) => void;
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  handleSort: (field: PromptSortField) => void;
  toggleSelectAll: () => void;
  toggleSelect: (id: string) => void;
  addPrompt: (data: PromptFormData) => void;
  updatePrompt: (id: string, data: Partial<PromptEntry>) => void;
  removePrompt: (id: string) => void;
  copyPrompt: (item: PromptEntry) => void;
  removeMultiple: (ids: Set<string>) => void;
  clearError: () => void;
  retry: () => void;
  /** Exposed for import/export composition — returns all items (unfiltered, unsorted) */
  getAllItems: () => PromptEntry[];
  /** Exposed for import/export composition — batch-append new items */
  addItems: (newItems: PromptEntry[]) => void;
}
