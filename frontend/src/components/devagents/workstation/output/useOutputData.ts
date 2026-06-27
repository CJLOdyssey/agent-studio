import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { OutputEntry, OutputFormData } from './output.types';
import { outputAPI } from './api';
import { PAGE_SIZE } from '../constants';
import { nextId, today } from '../utils';

export interface OutputData {
  isLoading: boolean; error: string | null;
  filtered: OutputEntry[]; paged: OutputEntry[]; page: number; totalPages: number;
  search: string; categoryFilter: string; selectedIds: Set<string>; allOnPageSelected: boolean;
  setSearch: (v: string) => void; setCategoryFilter: (v: string) => void; setPage: (v: number) => void;
  toggleSelect: (id: string) => void; toggleSelectAll: () => void;
  addItem: (data: OutputFormData) => void; updateItem: (id: string, data: Partial<OutputEntry>) => void;
  removeItem: (id: string) => void; copyItem: (item: OutputEntry) => void;
  removeMultiple: (ids: Set<string>) => void; getAllItems: () => OutputEntry[];
  addItems: (items: OutputEntry[]) => void; clearError: () => void;
  retry: () => void;
}

export function useOutputData(): OutputData {
  const [items, setItems] = useState<OutputEntry[]>([]);
  // eslint-disable-next-line react-hooks/refs
  const itemsRef = useRef(items); itemsRef.current = items;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true); setError(null);
    outputAPI.fetchAll()
      .then(data => { setItems(data); setIsLoading(false); })
      .catch(e => { setError(`加载失败：${(e as Error).message}`); setIsLoading(false); });
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  const filtered = useMemo(() => {
    let r = items;
    if (search) { const q = search.toLowerCase(); r = r.filter((i) => i.name.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)); }
    if (categoryFilter !== 'all') r = r.filter((i) => i.category === categoryFilter);
    return r;
  }, [items, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);
  const allOnPageSelected = paged.length > 0 && paged.every((i) => selectedIds.has(i.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(paged.map((i) => i.id)));
  }, [allOnPageSelected, paged]);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const addItem = useCallback((data: OutputFormData) => {
    try { setItems((prev) => [...prev, { id: nextId(itemsRef.current), ...data, createdAt: today() }]); setError(null); } catch (e) { setError(`创建失败：${(e as Error).message}`); }
  }, []);
  const updateItem = useCallback((id: string, data: Partial<OutputEntry>) => {
    try { setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i))); setError(null); } catch (e) { setError(`更新失败：${(e as Error).message}`); }
  }, []);
  const removeItem = useCallback((id: string) => {
    try { setItems((prev) => prev.filter((i) => i.id !== id)); setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); setError(null); } catch (e) { setError(`删除失败：${(e as Error).message}`); }
  }, []);
  const copyItem = useCallback((item: OutputEntry) => {
    try { setItems((prev) => [...prev, { ...item, id: nextId(itemsRef.current), name: `${item.name} (副本)`, createdAt: today() }]); setError(null); } catch (e) { setError(`复制失败：${(e as Error).message}`); }
  }, []);
  const removeMultiple = useCallback((ids: Set<string>) => {
    try { setItems((prev) => prev.filter((i) => !ids.has(i.id))); setSelectedIds(new Set()); setError(null); } catch (e) { setError(`批量删除失败：${(e as Error).message}`); }
  }, []);
  const getAllItems = useCallback(() => itemsRef.current, []);
  const addItems = useCallback((newItems: OutputEntry[]) => { try { setItems((prev) => [...prev, ...newItems]); setError(null); } catch (e) { setError(`导入失败：${(e as Error).message}`); } }, []);
  const clearError = useCallback(() => setError(null), []);
  const retry = useCallback(() => {
    setIsLoading(true); setError(null);
    outputAPI.fetchAll()
      .then(data => { setItems(data); setIsLoading(false); })
      .catch(e => { setError(`加载失败：${(e as Error).message}`); setIsLoading(false); });
  }, []);

  return { isLoading, error, filtered, paged, page: safePage, totalPages, search, categoryFilter, selectedIds, allOnPageSelected, setSearch, setCategoryFilter, setPage, toggleSelect, toggleSelectAll, addItem, updateItem, removeItem, copyItem, removeMultiple, getAllItems, addItems, clearError, retry };
}
