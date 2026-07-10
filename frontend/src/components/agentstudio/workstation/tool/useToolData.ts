import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SortDir } from '../types';
import type { ToolEntry } from './tool.types';
import { toolAPI } from './api';
import { PAGE_SIZE } from '../constants';

export type ToolSortField = 'name' | 'category' | 'status';
export type CategoryFilter = 'all' | string;
export type ToolStatusFilter = 'all' | ToolEntry['status'];

export interface ToolData {
  isLoading: boolean; error: string | null;
  paged: ToolEntry[]; processed: ToolEntry[];
  page: number; totalPages: number;
  search: string; categoryFilter: CategoryFilter; statusFilter: ToolStatusFilter;
  sortField: ToolSortField | null; sortDir: SortDir;
  selectedIds: Set<string>; allOnPageSelected: boolean;
  setSearch: (v: string) => void; setCategoryFilter: (v: CategoryFilter) => void; setStatusFilter: (v: ToolStatusFilter) => void;
  setPage: (v: number) => void;
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  handleSort: (field: ToolSortField) => void;
  toggleSelectAll: () => void; toggleSelect: (id: string) => void;
  addTool: (data: Omit<ToolEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateTool: (id: string, data: Partial<ToolEntry>) => Promise<void>;
  removeTool: (id: string) => Promise<void>; copyTool: (item: ToolEntry) => Promise<void>;
  removeMultiple: (ids: Set<string>) => Promise<void>; clearError: () => void; retry: () => void;
}

export function useToolData(): ToolData {
  const [items, setItems] = useState<ToolEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ToolStatusFilter>('all');
  const [sortField, setSortField] = useState<ToolSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  const load = useCallback(() => {
    setIsLoading(true); setError(null);
    cancelledRef.current = false;
    toolAPI.fetchAll()
      .then((data) => { if (!cancelledRef.current) setItems(data); })
      .catch((e) => { if (!cancelledRef.current) setError(`加载失败：${(e as Error).message}`); })
      .finally(() => { if (!cancelledRef.current) setIsLoading(false); });
    return () => { cancelledRef.current = true; };
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const c = load(); return c; }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, categoryFilter, sortField, sortDir, statusFilter]);

  const processed = useMemo(() => {
    let r = items;
    if (search) { const q = search.toLowerCase(); r = r.filter((i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)); }
    if (categoryFilter !== 'all') r = r.filter((i) => i.category === categoryFilter);
    if (statusFilter !== 'all') r = r.filter((i) => i.status === statusFilter);
    if (sortField) {
      r = [...r].sort((a, b) => {
        const va = String(a[sortField]).toLowerCase();
        const vb = String(b[sortField]).toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return r;
  }, [items, search, categoryFilter, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [processed, safePage]);
  const allOnPageSelected = paged.length > 0 && paged.every((i) => selectedIds.has(i.id));

  const handleSort = useCallback((field: ToolSortField) => { setSortField((prev) => { if (prev === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; } setSortDir('asc'); return field; }); setPage(1); }, []);
  const toggleSelect = useCallback((id: string) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleSelectAll = useCallback(() => setSelectedIds((prev) => paged.every((i) => prev.has(i.id)) ? new Set() : new Set(paged.map((i) => i.id))), [paged]);

  const addTool = useCallback(async (data: Omit<ToolEntry, 'id' | 'createdAt'>) => {
    try {
      const created = await toolAPI.create(data);
      setItems((prev) => [created, ...prev]);
    } catch (e) { setError(`创建失败：${(e as Error).message}`); }
  }, []);
  const updateTool = useCallback(async (id: string, data: Partial<ToolEntry>) => {
    try {
      await toolAPI.update(id, data);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...data } : i));
    } catch (e) { setError(`更新失败：${(e as Error).message}`); }
  }, []);
  const removeTool = useCallback(async (id: string) => {
    try {
      await toolAPI.remove(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) { setError(`删除失败：${(e as Error).message}`); }
  }, []);
  const copyTool = useCallback(async (item: ToolEntry) => {
    try {
      const cloned = await toolAPI.clone(item);
      setItems((prev) => [cloned, ...prev]);
    } catch (e) { setError(`复制失败：${(e as Error).message}`); }
  }, []);
  const removeMultiple = useCallback(async (ids: Set<string>) => {
    try {
      await toolAPI.removeBatch(ids);
      setItems((prev) => prev.filter((i) => !ids.has(i.id)));
      setSelectedIds(new Set());
      setPage(1);
    } catch (e) { setError(`批量删除失败：${(e as Error).message}`); }
  }, []);
  const clearError = useCallback(() => setError(null), []);
  const retry = useCallback(() => { load(); }, [load]);

  return {
    isLoading, error, search, setSearch, categoryFilter, setCategoryFilter, statusFilter, setStatusFilter,
    sortField, sortDir, page, setPage, selectedIds, setSelectedIds,
    processed, totalPages, paged, allOnPageSelected, toggleSelect, toggleSelectAll,
    handleSort, addTool, updateTool, removeTool, copyTool, removeMultiple,
    clearError, retry,
  };
}
