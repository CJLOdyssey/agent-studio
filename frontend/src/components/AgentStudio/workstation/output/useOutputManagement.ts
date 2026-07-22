import { useCallback, useRef } from 'react';
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
  // UI state — previously in useOutputUI, merged here
  isFormOpen: boolean; formErrors: string[];
  editingItem: OutputEntry | null; editingId: string | null;
  formData: OutputFormData;
  openMenuId: string | null; menuAnchorEl: HTMLElement | null;
  setFormData: (fn: (f: OutputFormData) => OutputFormData) => void;
  setOpenMenuId: (id: string | null) => void;
  setMenuAnchorEl: (el: HTMLElement | null) => void;
  openCreate: () => void; openEdit: (item: OutputEntry) => void;
  closeForm: () => void;
  /** Returns true if validation passed (save was triggered). */
  handleSave: () => boolean;
}

function validateOutputForm(data: OutputFormData): string[] {
  const e: string[] = [];
  const n = data.name.trim();
  if (!n || n.length < 2) e.push(n ? '至少2个字符' : '名称不能为空');
  if (n.length > 50) e.push('最多50个字符');
  if (!data.content.trim()) e.push('内容不能为空');
  return e;
}

const EMPTY_FORM: OutputFormData = {
  name: '', content: '', category: '格式约束' as OutputCategory, model: '全部模型', status: 'draft', version: 'v1.0.0',
};

export function useOutputManagement(): OutputData {
  const crud = useGenericCrud<OutputEntry, OutputFormData>({
    api: outputAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'Output',
    validate: validateOutputForm,
    extraFilters: { categoryFilter: 'all' },
  });

  const itemsRef = useRef(crud.items);
  itemsRef.current = crud.items;

  const getAllItems = useCallback(() => itemsRef.current, []);
  const addItems = useCallback((newItems: OutputEntry[]) => { crud.batchAdd(newItems); }, [crud]);

  const handleSave = useCallback((): boolean => {
    const errs = validateOutputForm(crud.formData);
    if (errs.length > 0) {
      crud.handleSave(); // sets formErrors via useGenericCrud
      return false;
    }
    crud.handleSave();
    return true;
  }, [crud]);

  return {
    isLoading: crud.isLoading,
    error: crud.error,
    filtered: crud.processed as OutputEntry[],
    paged: crud.paged as OutputEntry[],
    page: crud.page,
    totalPages: crud.totalPages,
    search: crud.search,
    categoryFilter: crud.extraFilterValues.categoryFilter ?? 'all',
    selectedIds: crud.selectedIds,
    allOnPageSelected: crud.allOnPageSelected,
    isFormOpen: crud.isFormOpen,
    formErrors: crud.formErrors,
    editingItem: crud.editingItem as OutputEntry | null,
    editingId: crud.editingItem?.id ?? null,
    formData: crud.formData as OutputFormData,
    openMenuId: crud.openMenuId,
    menuAnchorEl: crud.menuAnchorEl,
    setSearch: crud.setSearch,
    setCategoryFilter: (v) => crud.setExtraFilter('categoryFilter', v),
    setPage: crud.setPage,
    setFormData: (fn) => crud.setFormData(fn),
    setOpenMenuId: crud.setOpenMenuId,
    setMenuAnchorEl: crud.setMenuAnchorEl,
    toggleSelect: crud.toggleSelect,
    toggleSelectAll: crud.toggleSelectAll,
    addItem: ((data: OutputFormData) => crud.createItem(data).then(() => undefined)) as (data: OutputFormData) => Promise<void>,
    updateItem: crud.updateItem as (id: string, data: Partial<OutputEntry>) => Promise<void>,
    removeItem: (id) => { crud.removeItem(id); },
    copyItem: (item) => { crud.cloneItem(item); },
    removeMultiple: (ids) => { crud.removeMultipleItems(ids); },
    getAllItems,
    addItems,
    clearError: crud.clearError,
    retry: crud.retry,
    openCreate: crud.openCreate,
    openEdit: (item) => crud.openEdit(item),
    closeForm: crud.closeForm,
    handleSave,
  };
}
