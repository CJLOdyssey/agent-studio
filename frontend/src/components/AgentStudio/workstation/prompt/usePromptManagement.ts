import type { PromptEntry, PromptFormData, PromptCategory, PromptData, CategoryFilter } from './types';
import { promptAPI } from './api';
import { validatePromptForm } from './validate';
import { useGenericCrud } from '../shared/useGenericCrud';

export function usePromptManagement(): PromptData {
  const crud = useGenericCrud<PromptEntry, PromptFormData>({
    api: promptAPI,
    emptyForm: { name: '', content: '', category: '系统提示词' as PromptCategory, model: 'GPT-4o', status: 'draft' as const, version: 'v1.0.0' },
    itemName: '提示词',
    validate: validatePromptForm,
    sortFields: ['name', 'category', 'status'],
    extraFilters: { categoryFilter: 'all' },
  });

  return {
    ...crud,
    get categoryFilter() { return (crud.extraFilterValues.categoryFilter ?? 'all') as CategoryFilter; },
    setCategoryFilter: (v) => crud.setExtraFilter('categoryFilter', v as string),
    addPrompt: crud.createItem,
    updatePrompt: crud.updateItem,
    removePrompt: crud.removeItem,
    copyPrompt: crud.cloneItem,
    removeMultiple: crud.removeMultipleItems,
    /** Return ALL items (unfiltered) for JSON export. */
    getAllItems: () => crud.items,
    /** Batch-append imported items directly to local state (no API call). */
    addItems: (newItems) => { crud.batchAdd(newItems); },
  };
}
