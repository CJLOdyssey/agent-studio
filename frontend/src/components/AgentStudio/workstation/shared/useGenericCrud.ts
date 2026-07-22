/**
 * Generic CRUD hook — replaces the per-module pattern of:
 *   useXxxData() + useXxxUI() + validateXxx()
 *
 * Each module provides:
 *   - api: CRUD operations (fetchAll, create, update, remove)
 *   - emptyForm: default form state
 *   - validate(): optional form validation
 *   - itemName: entity label for error messages (e.g. "Skill")
 *
 * Returns unified data + UI state + action handlers.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { PAGE_SIZE } from '../constants';
import type { CrudAPI, GenericCrudConfig, GenericCrudReturn } from './useGenericCrud.types';

export type { CrudAPI, GenericCrudConfig, GenericCrudReturn };

// ── Hook ─────────────────────────────────────────────────────────

export function useGenericCrud<T extends { id: string }, F>(
  config: GenericCrudConfig<T, F>,
): GenericCrudReturn<T, F> {
  const { api, emptyForm, validate, sortFields, extraFilters } = config;
  const itemName = config.itemName;

  // ── Data state ─────────────────────────────────────────────────
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Search / sort / filter state ───────────────────────────────
  const [search, setSearch_] = useState('');
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [extraFilterValues, setExtraFilterValues_] = useState<Record<string, string>>(
    () => ({ ...extraFilters }),
  );

  // ── Pagination state ───────────────────────────────────────────
  const [page, setPage_] = useState(1);

  // ── Selection state ────────────────────────────────────────────
  const [selectedIds, setSelectedIds_] = useState<Set<string>>(new Set());

  // ── Form / modal state ─────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  const [historyItem, setHistoryItem] = useState<T | null>(null);
  const [formData_, setFormData_] = useState<F>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  // ── Data fetching ──────────────────────────────────────────────
  const fetchItems = useCallback(() => {
    setIsLoading(true);
    setError(null);
    api.fetchAll().then(setItems).catch((e: Error) => {
      setError(e.message || `Failed to load ${itemName}s`);
    }).finally(() => setIsLoading(false));
  }, [api, itemName]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const clearError = useCallback(() => setError(null), []);
  const retry = useCallback(() => fetchItems(), [fetchItems]);

  // Wrappers that also reset page / selection when filter changes
  const resetPagination = useCallback(() => { setPage_(1); setSelectedIds_(new Set()); }, []);

  const setSearch = useCallback((v: string) => { setSearch_(v); resetPagination(); }, [resetPagination]);
  const setPage = useCallback((v: number) => { setPage_(v); }, []);
  const setSelectedIds = useCallback((v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedIds_(v);
  }, []);

  // ── Data processing (memoized) ─────────────────────────────────
  const processed = useMemo(() => {
    let result = items;

    // Extra filters
    if (extraFilterValues && extraFilters) {
      for (const key of Object.keys(extraFilters)) {
        const val = extraFilterValues[key];
        if (val && val !== 'all') {
          result = result.filter((item) =>
            String((item as unknown as Record<string, unknown>)[key] ?? '') === val,
          );
        }
      }
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          String((item as unknown as Record<string, unknown>).name ?? '').toLowerCase().includes(q) ||
          String((item as unknown as Record<string, unknown>).description ?? '').toLowerCase().includes(q),
      );
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        const aRecord = a as unknown as Record<string, unknown>;
        const bRecord = b as unknown as Record<string, unknown>;
        const field = sortField as string;
        const aVal = String(aRecord[field] ?? '');
        const bVal = String(bRecord[field] ?? '');
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'zh-CN') : bVal.localeCompare(aVal, 'zh-CN');
      });
    }

    return result;
  }, [items, search, sortField, sortDir, extraFilterValues, extraFilters]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [processed, safePage],
  );

  const allOnPageSelected = useMemo(
    () => paged.length > 0 && paged.every((item) => selectedIds.has(item.id)),
    [paged, selectedIds],
  );

  // ── Selection handlers ────────────────────────────────────────
  const toggleSelectAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelectedIds_((prev) => {
        const next = new Set(prev);
        paged.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds_((prev) => {
        const next = new Set(prev);
        paged.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }, [allOnPageSelected, paged]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds_((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Sort handler (resets pagination) ──────────────────────────
  const handleSort = useCallback(
    (field: keyof T) => {
      if (sortFields && !sortFields.includes(field)) return;
      setSortField((prev) => {
        if (prev === field) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          return prev;
        }
        return field;
      });
      resetPagination();
    },
    [sortFields, resetPagination],
  );

  // ── Extra filter handler (resets pagination) ──────────────────
  const setExtraFilter = useCallback((key: string, value: string) => {
    setExtraFilterValues_((prev) => ({ ...prev, [key]: value }));
    resetPagination();
  }, [resetPagination]);

  // ── Mutations ─────────────────────────────────────────────────
  const createItem = useCallback(
    async (data: F) => {
      const created = await api.create(data);
      await fetchItems();
      return created;
    },
    [api, fetchItems],
  );

  const updateItem = useCallback(
    async (id: string, data: Partial<T>) => {
      await api.update(id, data);
      await fetchItems();
    },
    [api, fetchItems],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await api.remove(id);
      await fetchItems();
    },
    [api, fetchItems],
  );

  const cloneItem = useCallback(
    async (item: T) => {
      if (api.clone) {
        await api.clone(item);
      } else {
        const { id: _id, createdAt: _createdAt, ...rest } = item as unknown as Record<string, unknown>;
        await api.create(rest as unknown as F);
      }
      await fetchItems();
    },
    [api, fetchItems],
  );

  const removeMultipleItems = useCallback(
    async (ids: Set<string>) => {
      if (api.removeBatch) {
        await api.removeBatch(ids);
      } else {
        await Promise.all(Array.from(ids).map((id) => api.remove(id)));
      }
      await fetchItems();
    },
    [api, fetchItems],
  );

  // ── UI handlers ───────────────────────────────────────────────
  const setFormData = useCallback((v: F | ((prev: F) => F)) => {
    setFormData_(v);
  }, []);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setFormData_(emptyForm);
    setFormErrors([]);
    setIsFormOpen(true);
  }, [emptyForm]);

  const openEdit = useCallback((item: T) => {
    setEditingItem(item);
    const { id: _id, createdAt: _createdAt, ...itemData } = item as unknown as Record<string, unknown>;
    setFormData_(itemData as unknown as F);
    setFormErrors([]);
    setIsFormOpen(true);
  }, []);

  const openDelete = useCallback((item: T) => {
    setDeletingItem(item);
    setIsDeleteOpen(true);
  }, []);

  const openHistory = useCallback((item: T) => {
    setHistoryItem(item);
    setIsHistoryOpen(true);
  }, []);

  const openBatchDelete = useCallback(() => {
    setIsBatchDeleteOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setFormErrors([]);
  }, []);

  const closeDelete = useCallback(() => {
    setIsDeleteOpen(false);
    setDeletingItem(null);
  }, []);

  const closeBatchDelete = useCallback(() => {
    setIsBatchDeleteOpen(false);
  }, []);

  const closeHistory = useCallback(() => {
    setIsHistoryOpen(false);
    setHistoryItem(null);
  }, []);

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setMenuAnchorEl(null);
  }, []);

  // Click-outside for dropdown menu
  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) {
        setOpenMenuId(null);
        setMenuAnchorEl(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  // ── Save / Delete / Batch Delete orchestration ────────────────
  const handleSave = useCallback(() => {
    const errors = validate ? validate(formData_, items, editingItem?.id) : [];
    setFormErrors(errors);
    if (errors.length > 0) return;
    const action = editingItem
      ? updateItem(editingItem.id, formData_ as unknown as Partial<T>)
      : createItem(formData_);
    action.then(() => {
      setIsFormOpen(false);
    });
  }, [validate, formData_, items, editingItem, updateItem, createItem]);

  const handleDelete = useCallback(() => {
    if (!deletingItem) return;
    removeItem(deletingItem.id).then(() => {
      setIsDeleteOpen(false);
      setDeletingItem(null);
    });
  }, [deletingItem, removeItem]);

  const handleBatchDelete = useCallback(() => {
    removeMultipleItems(selectedIds).then(() => {
      setIsBatchDeleteOpen(false);
      setSelectedIds_(new Set());
    });
  }, [selectedIds, removeMultipleItems]);

  // ── Batch add (import flow) ───────────────────────────────────
  const batchAdd = useCallback((newItems: T[]) => {
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  // ── Return ────────────────────────────────────────────────────
  return {
    items,
    isLoading,
    error,
    processed,
    paged,
    page: safePage,
    totalPages,
    search,
    sortField,
    sortDir,
    selectedIds,
    allOnPageSelected,
    extraFilterValues,

    editingItem,
    deletingItem,
    historyItem,
    formData: formData_,
    formErrors,
    isFormOpen,
    isDeleteOpen,
    isBatchDeleteOpen,
    isHistoryOpen,
    openMenuId,
    menuAnchorEl,

    setSearch,
    setPage,
    setSelectedIds,
    setOpenMenuId,
    setMenuAnchorEl,
    setFormData,
    setExtraFilter,
    handleSort,
    toggleSelectAll,
    toggleSelect,

    createItem,
    updateItem,
    removeItem,
    cloneItem,
    removeMultipleItems,

    openCreate,
    openEdit,
    openDelete,
    openHistory,
    openBatchDelete,
    handleSave,
    handleDelete,
    handleBatchDelete,
    closeForm,
    closeDelete,
    closeBatchDelete,
    closeHistory,
    closeMenu,
    clearError,
    retry,
    batchAdd,
  };
}
