import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { PromptEntry, PromptSortField, CategoryFilter, PromptData } from './types';
import { promptAPI } from './api';
import { PAGE_SIZE } from '../constants';

export type { PromptSortField, CategoryFilter, PromptData };

export function usePromptData(): PromptData {
  const [items, setItems] = useState<PromptEntry[]>([]);
  const itemsRef = useRef<PromptEntry[]>(items);
  itemsRef.current = items;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortField, setSortField] = useState<PromptSortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setIsLoading(true); setError(null);
    promptAPI.fetchAll()
      .then(data => { setItems(data); setIsLoading(false); })
      .catch(e => { setError(`加载失败：${(e as Error).message}`); setIsLoading(false); });
    return () => {};
  }, []);

  useEffect(() => { const c = load(); return c; }, [load]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, categoryFilter, sortField, sortDir]);

  const processed = useMemo(() => {
    let r = categoryFilter === 'all' ? items : items.filter((s) => s.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
      );
    }
    if (sortField) {
      r = [...r].sort((a, b) => {
        const va = String(a[sortField]).toLowerCase();
        const vb = String(b[sortField]).toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return r;
  }, [items, search, categoryFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [processed, safePage]);
  const allOnPageSelected = paged.length > 0 && paged.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(paged.map((p) => p.id)));
  }, [allOnPageSelected, paged]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const handleSort = useCallback((field: PromptSortField) => {
    setSortField((prev) => {
      if (prev === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else setSortDir('asc');
      return field;
    });
  }, []);

  const addPrompt = useCallback(async (data: Omit<PromptEntry, 'id' | 'createdAt'>) => {
    try { const entry = await promptAPI.create(data); setItems((prev) => [entry, ...prev]); setError(null); }
    catch (e) { setError(`创建失败：${(e as Error).message}`); }
  }, []);

  const updatePrompt = useCallback(async (id: string, data: Partial<PromptEntry>) => {
    try { await promptAPI.update(id, data); setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s))); setError(null); }
    catch (e) { setError(`更新失败：${(e as Error).message}`); }
  }, []);

  const removePrompt = useCallback(async (id: string) => {
    try { await promptAPI.remove(id); setItems((prev) => prev.filter((s) => s.id !== id)); setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); setError(null); }
    catch (e) { setError(`删除失败：${(e as Error).message}`); }
  }, []);

  const copyPrompt = useCallback(async (item: PromptEntry) => {
    try { const cloned = await promptAPI.clone(item); setItems((prev) => [...prev, cloned]); setError(null); }
    catch (e) { setError(`复制失败：${(e as Error).message}`); }
  }, []);

  const removeMultiple = useCallback(async (ids: Set<string>) => {
    try { await promptAPI.removeBatch(ids); setItems((prev) => prev.filter((s) => !ids.has(s.id))); setSelectedIds(new Set()); setError(null); }
    catch (e) { setError(`批量删除失败：${(e as Error).message}`); }
  }, []);

  const getAllItems = useCallback(() => itemsRef.current, []);

  const addItems = useCallback((newItems: PromptEntry[]) => {
    try {
      setItems((prev) => [...prev, ...newItems]);
      setError(null);
    } catch (e) { setError(`导入失败：${(e as Error).message}`); }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const retry = useCallback(() => { load(); }, [load]);

  return {
    isLoading, error, paged, processed, page: safePage, totalPages,
    search, categoryFilter, sortField, sortDir,
    selectedIds, allOnPageSelected,
    setSearch, setCategoryFilter, setPage, setSelectedIds,
    handleSort, toggleSelectAll, toggleSelect,
    addPrompt, updatePrompt, removePrompt, copyPrompt, removeMultiple,
    getAllItems, addItems, clearError, retry,
  };
}
