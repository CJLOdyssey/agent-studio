/**
 * 通用 CRUD hook——替代各模块各自的模式：
 *   useXxxData() + useXxxUI() + validateXxx()
 *
 * 各模块需提供：
 *   - api: CRUD 操作（fetchAll、create、update、remove）
 *   - emptyForm: 默认表单状态
 *   - validate(): 可选表单校验
 *   - itemName: 错误信息中的实体名称（如 "Skill"）
 *
 * 返回统一的数据 + UI 状态 + 操作处理器。
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { PAGE_SIZE } from '../constants';
import type { CrudAPI, GenericCrudConfig, GenericCrudReturn } from './useGenericCrud.types';

export type { CrudAPI, GenericCrudConfig, GenericCrudReturn };

// ── 安全访问泛型对象的辅助函数 ───────────────────────
function getField(obj: unknown, key: string): string {
  return String(Reflect.get(Object(obj ?? {}), key) ?? '');
}
function asPartial<T>(data: unknown): Partial<T> {
  return data as Partial<T>;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useGenericCrud<T extends { id: string }, F>(
  config: GenericCrudConfig<T, F>,
): GenericCrudReturn<T, F> {
  const { api, emptyForm, validate, sortFields, extraFilters } = config;
  const itemName = config.itemName;

  // ── 数据状态 ─────────────────────────────────────────────────
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── 搜索 / 排序 / 筛选状态 ───────────────────────────────
  const [search, setSearch_] = useState('');
  const [sortField, setSortField] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [extraFilterValues, setExtraFilterValues_] = useState<Record<string, string>>(
    () => ({ ...extraFilters }),
  );

  // ── 分页状态 ───────────────────────────────────────────
  const [page, setPage_] = useState(1);

  // ── 选择状态 ────────────────────────────────────────────
  const [selectedIds, setSelectedIds_] = useState<Set<string>>(new Set());

  // ── 表单 / 弹窗状态 ─────────────────────────────────────────
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

  // ── 数据拉取 ──────────────────────────────────────────────
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

  // 筛选变化时同时重置页码 / 选中的包装函数
  const resetPagination = useCallback(() => { setPage_(1); setSelectedIds_(new Set()); }, []);

  const setSearch = useCallback((v: string) => { setSearch_(v); resetPagination(); }, [resetPagination]);
  const setPage = useCallback((v: number) => { setPage_(v); }, []);
  const setSelectedIds = useCallback((v: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedIds_(v);
  }, []);

  // ── 数据处理（memoized） ─────────────────────────────────
  const processed = useMemo(() => {
    let result = items;

    // 额外筛选
    if (extraFilterValues && extraFilters) {
      for (const key of Object.keys(extraFilters)) {
        const val = extraFilterValues[key];
        if (val && val !== 'all') {
          result = result.filter((item) => getField(item, key) === val,
          );
        }
      }
    }

    // 搜索
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          getField(item, 'name').toLowerCase().includes(q) ||
          getField(item, 'description').toLowerCase().includes(q),
      );
    }

    // 排序
    if (sortField) {
      result.sort((a, b) => {
        const field = sortField as string;
        const aVal = getField(a, field);
        const bVal = getField(b, field);
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

  // ── 选择处理器 ────────────────────────────────────────
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

  // ── 排序处理器（重置分页） ──────────────────────────
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

  // ── 额外筛选处理器（重置分页） ──────────────────
  const setExtraFilter = useCallback((key: string, value: string) => {
    setExtraFilterValues_((prev) => ({ ...prev, [key]: value }));
    resetPagination();
  }, [resetPagination]);

  // ── 变更操作 ─────────────────────────────────────────────────
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
        // 作为表单数据传入前先剥离 id/createdAt
        const form = Object.fromEntries(
          Object.entries(item).filter(([k]) => k !== 'id' && k !== 'createdAt'),
        );
        await api.create(form as F);
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

  // ── UI 处理器 ───────────────────────────────────────────────
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
    const form = Object.fromEntries(
      Object.entries(item).filter(([k]) => k !== 'id' && k !== 'createdAt'),
    );
    setFormData_(form as F);
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

  // 下拉菜单点击外部关闭
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

  // ── 保存 / 删除 / 批量删除编排 ────────────────
  const handleSave = useCallback((): Promise<void> | undefined => {
    const errors = validate ? validate(formData_, items, editingItem?.id) : [];
    setFormErrors(errors);
    if (errors.length > 0) return undefined;
    const action = editingItem
      ? updateItem(editingItem.id, asPartial(formData_))
      : createItem(formData_);
    return action.then(() => {
      setIsFormOpen(false);
      setFormErrors([]);
    }).catch((e: Error) => {
      setError(e.message || `保存${itemName}失败`);
    });
  }, [validate, formData_, items, editingItem, updateItem, createItem, itemName]);

  const handleDelete = useCallback((): Promise<void> | undefined => {
    if (!deletingItem) return undefined;
    return removeItem(deletingItem.id).then(() => {
      setIsDeleteOpen(false);
      setDeletingItem(null);
    }).catch((e: Error) => {
      setError(e.message || `删除${itemName}失败`);
    });
  }, [deletingItem, removeItem, itemName]);

  const handleBatchDelete = useCallback((): Promise<void> | undefined => {
    if (selectedIds.size === 0) return undefined;
    return removeMultipleItems(selectedIds).then(() => {
      setIsBatchDeleteOpen(false);
      setSelectedIds_(new Set());
    }).catch((e: Error) => {
      setError(e.message || `批量删除失败`);
    });
  }, [selectedIds, removeMultipleItems]);

  // ── 批量添加（导入流程） ───────────────────────────────────
  const batchAdd = useCallback((newItems: T[]) => {
    setItems((prev) => [...prev, ...newItems]);
  }, []);

  // ── 返回值 ────────────────────────────────────────────────────
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
