import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SortDir } from '../types';
import type { ToolEntry } from './tool.types';
import { toolAPI } from './api';
import { PAGE_SIZE } from '../constants';

export type ToolSortField = 'name' | 'category' | 'status';
export type CategoryFilter = 'all' | string;

export interface ToolData {
  isLoading: boolean; error: string | null;
  paged: ToolEntry[]; processed: ToolEntry[];
  page: number; totalPages: number;
  search: string; categoryFilter: CategoryFilter;
  sortField: ToolSortField | null; sortDir: SortDir;
  selectedIds: Set<string>; allOnPageSelected: boolean;
  setSearch: (v: string) => void; setCategoryFilter: (v: CategoryFilter) => void; setPage: (v: number) => void;
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  handleSort: (field: ToolSortField) => void;
  toggleSelectAll: () => void; toggleSelect: (id: string) => void;
  addTool: (data: Omit<ToolEntry, 'id' | 'createdAt'>) => void;
  updateTool: (id: string, data: Partial<ToolEntry>) => void;
  removeTool: (id: string) => void; copyTool: (item: ToolEntry) => void;
  removeMultiple: (ids: Set<string>) => void; clearError: () => void; retry: () => void;
}

export function useToolData(): ToolData {
  const [items, setItems] = useState<ToolEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search_, setSearch_] = useState('');
  const [categoryFilter_, setCategoryFilter_] = useState<CategoryFilter>('all');
  const [sortField, setSortField] = useState<ToolSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    toolAPI.fetchAll()
      .then((data) => { if (!cancelled) { setItems(data); setIsLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(`加载失败：${(e as Error).message}`); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const setSearch = useCallback((v: string) => { setSearch_(v); setPage(1); setSelectedIds(new Set()); }, []);
  const setCategoryFilter = useCallback((v: CategoryFilter) => { setCategoryFilter_(v); setPage(1); setSelectedIds(new Set()); }, []);

  const processed = useMemo(() => {
    let r = categoryFilter_ === 'all' ? items : items.filter((s) => s.category === categoryFilter_);
    if (search_.trim()) {
      const q = search_.toLowerCase();
      r = r.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
    }
    if (sortField) {
      r = [...r].sort((a, b) => {
        const va = String(a[sortField]).toLowerCase();
        const vb = String(b[sortField]).toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return r;
  }, [items, search_, categoryFilter_, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [processed, safePage]);
  const allOnPageSelected = paged.length > 0 && paged.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = useCallback(() => { setSelectedIds(allOnPageSelected ? new Set() : new Set(paged.map((p) => p.id))); }, [allOnPageSelected, paged]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  const handleSort = useCallback((field: ToolSortField) => {
    setSortField((prev) => { if (prev === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else setSortDir('asc'); return field; });
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const addTool = useCallback(async (data: Omit<ToolEntry, 'id' | 'createdAt'>) => {
    try { const item = await toolAPI.create(data); setItems((prev) => [...prev, item]); setError(null); }
    catch (e) { setError(`创建失败：${(e as Error).message}`); }
  }, []);
  const updateTool = useCallback(async (id: string, data: Partial<ToolEntry>) => {
    try { await toolAPI.update(id, data); setItems((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s)); setError(null); }
    catch (e) { setError(`更新失败：${(e as Error).message}`); }
  }, []);
  const removeTool = useCallback(async (id: string) => {
    try { await toolAPI.remove(id); setItems((prev) => prev.filter((s) => s.id !== id)); setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); setError(null); }
    catch (e) { setError(`删除失败：${(e as Error).message}`); }
  }, []);
  const copyTool = useCallback(async (item: ToolEntry) => {
    try { const cloned = await toolAPI.clone(item); setItems((prev) => [...prev, cloned]); setError(null); }
    catch (e) { setError(`复制失败：${(e as Error).message}`); }
  }, []);
  const removeMultiple = useCallback(async (ids: Set<string>) => {
    try { await toolAPI.removeBatch(ids); setItems((prev) => prev.filter((s) => !ids.has(s.id))); setSelectedIds(new Set()); setError(null); }
    catch (e) { setError(`批量删除失败：${(e as Error).message}`); }
  }, []);
  const clearError = useCallback(() => setError(null), []);

  const retry = useCallback(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    toolAPI.fetchAll()
      .then((data) => { if (!cancelled) { setItems(data); setIsLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(`加载失败：${(e as Error).message}`); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { isLoading, error, paged, processed, page: safePage, totalPages, search: search_, categoryFilter: categoryFilter_, sortField, sortDir, selectedIds, allOnPageSelected, setSearch, setCategoryFilter, setPage, setSelectedIds, handleSort, toggleSelectAll, toggleSelect, addTool, updateTool, removeTool, copyTool, removeMultiple, clearError, retry };
}
