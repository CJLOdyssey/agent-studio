import type { OutputEntry, OutputFormData, OutputCategory } from './output.types';
import { outputAPI } from './api';
import { useGenericCrud } from '../shared/useGenericCrud';

export interface OutputData {
  isLoading: boolean; error: string | null;
  filtered: OutputEntry[]; paged: OutputEntry[]; page: number; totalPages: number;
  search: string; categoryFilter: string; selectedIds: Set<string>; allOnPageSelected: boolean;
  setSearch: (v: string) => void; setCategoryFilter: (v: string) => void; setPage: (v: number) => void;
  toggleSelect: (id: string) => void; toggleSelectAll: () => void;
  addItem: (data: OutputFormData) => Promise<void>; updateItem: (id: string, data: Partial<OutputEntry>) => Promise<void>;
  removeItem: (id: string) => void; copyItem: (item: OutputEntry) => void;
  removeMultiple: (ids: Set<string>) => void; getAllItems: () => OutputEntry[];
  addItems: (items: OutputEntry[]) => void; clearError: () => void;
  retry: () => void;
}

export function useOutputData(): OutputData {
  const crud = useGenericCrud<OutputEntry, OutputFormData>({
    api: outputAPI,
    emptyForm: { name: '', content: '', category: '格式约束' as OutputCategory, model: '全部模型', status: 'draft' as const, version: 'v1.0.0' },
    itemName: '输出约束',
    sortFields: ['name', 'category', 'status'],
    extraFilters: { categoryFilter: 'all' },
  });

  return {
    isLoading: crud.isLoading,
    error: crud.error,
    filtered: crud.processed,
    paged: crud.paged,
    page: crud.page,
    totalPages: crud.totalPages,
    search: crud.search,
    categoryFilter: (crud.extraFilterValues.categoryFilter ?? 'all') as string,
    selectedIds: crud.selectedIds,
    allOnPageSelected: crud.allOnPageSelected,
    setSearch: crud.setSearch,
    setCategoryFilter: (v: string) => crud.setExtraFilter('categoryFilter', v),
    setPage: crud.setPage,
    toggleSelect: crud.toggleSelect,
    toggleSelectAll: crud.toggleSelectAll,
    addItem: async (data) => { await crud.createItem(data); },
    updateItem: crud.updateItem,
    removeItem: (id: string) => { void crud.removeItem(id); },
    copyItem: (item: OutputEntry) => { void crud.cloneItem(item); },
    removeMultiple: (ids: Set<string>) => { void crud.removeMultipleItems(ids); },
    getAllItems: () => crud.items,
    addItems: (items: OutputEntry[]) => { crud.batchAdd(items); },
    clearError: crud.clearError,
    retry: crud.retry,
  };
}
