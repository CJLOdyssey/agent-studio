import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { OutputEntry, OutputFormData, OutputCategory } from './output.types';
import { outputAPI } from './api';
import { useGenericCrud } from '../shared/useGenericCrud';

export interface OutputData {
  isLoading: boolean; error: string | null;
  filtered: OutputEntry[]; paged: OutputEntry[]; page: number; totalPages: number;
  search: string; statusFilter: string; categoryFilter: string; selectedIds: Set<string>; allOnPageSelected: boolean;
  setSearch: (v: string) => void; setStatusFilter: (v: string) => void; setCategoryFilter: (v: string) => void; setPage: (v: number) => void;
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
  name: '', content: '', category: '格式约束' as OutputCategory, status: 'draft',
};

export function useOutputManagement(): OutputData {
  const crud = useGenericCrud<OutputEntry, OutputFormData>({
    api: outputAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'Output',
    validate: validateOutputForm,
    extraFilters: { status: 'all', category: 'all' },
  });

  const itemsRef = useRef(crud.items);
  useEffect(() => { itemsRef.current = crud.items; });

  const getAllItems = useCallback(() => itemsRef.current, []);
  const addItems = useCallback((newItems: OutputEntry[]) => { crud.batchAdd(newItems); }, [crud]);

  const handleSave = useCallback((): boolean => {
    const errs = validateOutputForm(crud.formData);
    if (errs.length > 0) {
      void crud.handleSave(); // sets formErrors via useGenericCrud
      return false;
    }
    void crud.handleSave();
    return true;
  }, [crud]);

  return useMemo(() => ({
    ...crud,
    filtered: crud.processed,
    paged: crud.paged,
    statusFilter: crud.extraFilterValues.status ?? 'all',
    categoryFilter: crud.extraFilterValues.category ?? 'all',
    editingItem: crud.editingItem,
    editingId: crud.editingItem?.id ?? null,
    formData: crud.formData,
    setStatusFilter: (v) => crud.setExtraFilter('status', v),
    setCategoryFilter: (v) => crud.setExtraFilter('category', v),
    setFormData: (fn) => crud.setFormData(fn),
    addItem: ((data: OutputFormData) => crud.createItem(data).then(() => undefined)),
    updateItem: crud.updateItem,
    removeItem: (id) => { void crud.removeItem(id); },
    copyItem: (item) => { void crud.cloneItem(item); },
    removeMultiple: (ids) => { void crud.removeMultipleItems(ids); },
    getAllItems,
    addItems,
    handleSave,
  }), [crud, getAllItems, addItems, handleSave]);
}
