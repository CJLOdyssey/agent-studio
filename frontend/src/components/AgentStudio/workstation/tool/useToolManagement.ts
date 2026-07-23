import { useMemo, useCallback } from 'react';
import type { ToolEntry, ToolFormData, ToolData } from './tool.types';
import { toolAPI } from './api';
import { useGenericCrud } from '../shared/useGenericCrud';
import { EMPTY_FORM, validateToolForm } from './validate';

export function useToolManagement(): ToolData {
  const crud = useGenericCrud<ToolEntry, ToolFormData>({
    api: toolAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'Tool',
    validate: validateToolForm,
    extraFilters: { categoryFilter: 'all', statusFilter: 'all' },
  });

  const addTool = useCallback(async (data: ToolFormData) => {
    await crud.createItem(data);
  }, [crud]);

  const updateTool = useCallback(async (id: string, data: Partial<ToolEntry>) => {
    await crud.updateItem(id, data);
  }, [crud]);

  const removeTool = useCallback(async (id: string) => {
    await crud.removeItem(id);
  }, [crud]);

  const copyTool = useCallback(async (item: ToolEntry) => {
    await crud.cloneItem(item);
  }, [crud]);

  const removeMultiple = useCallback(async (ids: Set<string>) => {
    await crud.removeMultipleItems(ids);
  }, [crud]);

  return useMemo(() => ({
    ...crud,
    get categoryFilter() { return crud.extraFilterValues.categoryFilter ?? 'all'; },
    get statusFilter() { return crud.extraFilterValues.statusFilter ?? 'all'; },
    setCategoryFilter: (v: string) => crud.setExtraFilter('categoryFilter', v),
    setStatusFilter: (v: string) => crud.setExtraFilter('statusFilter', v),
    addTool,
    updateTool,
    removeTool,
    copyTool,
    removeMultiple,
    // Override GenericCrudReturn handlerSort to match ToolEntry key subset
    handleSort: (field: keyof ToolEntry) => crud.handleSort(field),
  }), [crud, addTool, updateTool, removeTool, copyTool, removeMultiple]);
}
