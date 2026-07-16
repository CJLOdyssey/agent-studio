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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SortDir } from '../types';
import { PAGE_SIZE } from '../constants';

// ── Generic types ────────────────────────────────────────────────

/** Minimal CRUD service interface — must be adapted per module. */
export interface CrudAPI<T, F> {
  fetchAll(): Promise<T[]>;
  create(data: F): Promise<T>;
  update(id: string, data: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
  clone?(item: T): Promise<T>;
  removeBatch?(ids: Set<string>): Promise<void>;
}

export interface GenericCrudConfig<T, F> {
  api: CrudAPI<T, F>;
  emptyForm: F;
  itemName: string;
  validate?: (data: F, items: T[], editingId?: string) => string[];
  /** Sort field keys relevant for this entity (clickable column headers). */
  sortFields?: (keyof T)[];
  /** Extra filter keys that reset page on change. E.g. { categoryFilter: 'all', statusFilter: 'all' } */
  extraFilters?: Record<string, string>;
}

// ── Return type ──────────────────────────────────────────────────

export interface GenericCrudReturn<T, F> {
  /* Data */
  items: T[];
  isLoading: boolean;
  error: string | null;
  processed: T[];
  paged: T[];
  page: number;
  totalPages: number;
  search: string;
  sortField: keyof T | null;
  sortDir: SortDir;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  extraFilterValues: Record<string, string>;

  /* UI */
  editingItem: T | null;
  deletingItem: T | null;
  historyItem: T | null;
  formData: F;
  formErrors: string[];
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;

  /* Setters */
  setSearch(v: string): void;
  setPage(v: number): void;
  setSelectedIds(v: Set<string> | ((prev: Set<string>) => Set<string>)): void;
  setOpenMenuId(v: string | null): void;
  setMenuAnchorEl(v: HTMLElement | null): void;
  setFormData(v: F | ((prev: F) => F)): void;
  setExtraFilter(key: string, value: string): void;
  handleSort(field: keyof T): void;
  toggleSelectAll(): void;
  toggleSelect(id: string): void;

  /* CRUD handlers */
  createItem(data: F): Promise<void>;
  updateItem(id: string, data: Partial<T>): Promise<void>;
  removeItem(id: string): Promise<void>;
  cloneItem(item: T): Promise<void>;
  removeMultipleItems(ids: Set<string>): Promise<void>;

  /* UI handlers */
  openCreate(): void;
  openEdit(item: T): void;
  openDelete(item: T): void;
  openHistory(item: T): void;
  openBatchDelete(): void;
  handleSave(): void;
  handleDelete(): void;
  handleBatchDelete(): void;
  closeForm(): void;
  closeDelete(): void;
  closeBatchDelete(): void;
  closeHistory(): void;
  closeMenu(): void;
  clearError(): void;
  retry(): void;
  /** Directly append items to local state (no API call). Used by import flows. */
  batchAdd(newItems: T[]): void;
}

// ── Implementation ───────────────────────────────────────────────

export function useGenericCrud<T extends { id: string }, F extends Record<string, unknown>>(
  config: GenericCrudConfig<T, F>,
): GenericCrudReturn<T, F> {
  const { api, emptyForm, itemName, validate, sortFields, extraFilters: extraFilterDefaults } = config;

  // ── Data state ────────────────────────────────────────────────
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>(
    () => extraFilterDefaults ?? {},
  );

  const cancelledRef = useRef(false);

  // ── UI state ──────────────────────────────────────────────────
  const [formData, setFormData_] = useState<F>(emptyForm);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  const [historyItem, setHistoryItem] = useState<T | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchItems = useCallback(() => {
    setIsLoading(true);
    setError(null);
    cancelledRef.current = false;
    api
      .fetchAll()
      .then((data) => {
        if (!cancelledRef.current) setItems(data);
      })
      .catch((e: Error) => {
        if (!cancelledRef.current) setError(`加载${itemName}失败：${e.message}`);
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [api, itemName]);

  const retry = useCallback(() => fetchItems(), [fetchItems]);
  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const c = fetchItems();
    return c;
  }, [fetchItems]);

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    setSelectedIds(new Set());
  }, [search, sortField, sortDir, extraFilterValues]);

  // ── Processing + Pagination ───────────────────────────────────
  const processed = useMemo(() => {
    let result = [...items];

    // Apply extra filters
    for (const [key, value] of Object.entries(extraFilterValues)) {
      if (value === 'all') continue;
      // Try to match by key name convention: e.g. categoryFilter -> item.category
      const field = key.replace(/Filter$/i, '').toLowerCase();
      result = result.filter((item) => {
        const itemVal = (item as unknown as Record<string, unknown>)[field];
        return String(itemVal) === value;
      });
    }

    // Search (fuzzy on name + description)
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
  }, [items, search, sortField, sortDir, extraFilterValues]);

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
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paged.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paged.forEach((item) => next.add(item.id));
        return next;
      });
    }
  }, [allOnPageSelected, paged]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Sort handler ──────────────────────────────────────────────
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
    },
    [sortFields],
  );

  // ── Extra filter handler ──────────────────────────────────────
  const setExtraFilter = useCallback((key: string, value: string) => {
    setExtraFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── CRUD handlers ─────────────────────────────────────────────
  const createItem = useCallback(
    async (data: F) => {
      await api.create(data);
      await fetchItems();
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
        // Default: create with same data (minus id + createdAt)
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
    // Populate form with current item values
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
    if (!openMenuId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMenuAnchorEl(null);
      return;
    }
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
    const errors = validate ? validate(formData, items, editingItem?.id) : [];
    setFormErrors(errors);
    if (errors.length > 0) return;
    const action = editingItem
      ? updateItem(editingItem.id, formData as unknown as Partial<T>)
      : createItem(formData);
    action.then(() => {
      setIsFormOpen(false);
    });
  }, [validate, formData, items, editingItem, updateItem, createItem]);

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
      setSelectedIds(new Set());
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
    formData,
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
