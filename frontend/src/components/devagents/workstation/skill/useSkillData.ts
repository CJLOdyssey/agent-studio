import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SortDir } from '../types';
import type { SkillEntry, SkillFormData } from './skill.types';
import { skillAPI } from './api';
import { PAGE_SIZE } from '../constants';

export type SkillSortField = 'name' | 'category' | 'status';
export type CategoryFilter = 'all' | string;

export interface SkillData {
  isLoading: boolean;
  error: string | null;
  paged: SkillEntry[];
  processed: SkillEntry[];
  page: number;
  totalPages: number;
  search: string;
  categoryFilter: CategoryFilter;
  sortField: SkillSortField | null;
  sortDir: SortDir;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  setSearch: (v: string) => void;
  setCategoryFilter: (v: CategoryFilter) => void;
  setPage: (v: number) => void;
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  handleSort: (field: SkillSortField) => void;
  toggleSelectAll: () => void;
  toggleSelect: (id: string) => void;
  addSkill: (data: SkillFormData) => void;
  updateSkill: (id: string, data: Partial<SkillEntry>) => void;
  removeSkill: (id: string) => void;
  copySkill: (item: SkillEntry) => void;
  removeMultiple: (ids: Set<string>) => void;
  retry: () => void;
  clearError: () => void;
}

export function useSkillData(): SkillData {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortField, setSortField] = useState<SkillSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  const fetchSkills = useCallback(() => {
    setIsLoading(true); setError(null);
    cancelledRef.current = false;
    skillAPI.fetchAll()
      .then((data) => { if (!cancelledRef.current) setSkills(data); })
      .catch(() => { if (!cancelledRef.current) setError('Failed to load skills'); })
      .finally(() => { if (!cancelledRef.current) setIsLoading(false); });
    return () => { cancelledRef.current = true; };
  }, []);

  const retry = useCallback(() => fetchSkills(), [fetchSkills]);
  const clearError = useCallback(() => setError(null), []);

  useEffect(() => { const c = fetchSkills(); return c; }, [fetchSkills]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, categoryFilter, sortField, sortDir]);

  const processed = useMemo(() => {
    let result = categoryFilter === 'all' ? skills : skills.filter((s) => s.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        const va = String(a[sortField]).toLowerCase();
        const vb = String(b[sortField]).toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [skills, search, categoryFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return processed.slice(start, start + PAGE_SIZE);
  }, [processed, safePage]);

  const allOnPageSelected = paged.length > 0 && paged.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = useCallback(() => { setSelectedIds(allOnPageSelected ? new Set() : new Set(paged.map((p) => p.id))); }, [allOnPageSelected, paged]);
  const toggleSelect = useCallback((id: string) => { setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }, []);
  const handleSort = useCallback((field: SkillSortField) => { setSortField((prev) => { if (prev === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else setSortDir('asc'); return field; }); }, []);

  const addSkill = useCallback(async (data: SkillFormData) => {
    try { const created = await skillAPI.create(data); setSkills((prev) => [...prev, created]); setError(null); }
    catch (e) { setError(`创建失败：${(e as Error).message}`); }
  }, []);
  const updateSkill = useCallback(async (id: string, data: Partial<SkillEntry>) => {
    try { await skillAPI.update(id, data); setSkills((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s)); setError(null); }
    catch (e) { setError(`更新失败：${(e as Error).message}`); }
  }, []);
  const removeSkill = useCallback(async (id: string) => {
    try { await skillAPI.remove(id); setSkills((prev) => prev.filter((s) => s.id !== id)); setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); setError(null); }
    catch (e) { setError(`删除失败：${(e as Error).message}`); }
  }, []);
  const copySkill = useCallback(async (item: SkillEntry) => {
    try { const cloned = await skillAPI.clone(item); setSkills((prev) => [...prev, cloned]); setError(null); }
    catch (e) { setError(`复制失败：${(e as Error).message}`); }
  }, []);
  const removeMultiple = useCallback(async (ids: Set<string>) => {
    try { await skillAPI.removeBatch(ids); setSkills((prev) => prev.filter((s) => !ids.has(s.id))); setSelectedIds(new Set()); setError(null); }
    catch (e) { setError(`批量删除失败：${(e as Error).message}`); }
  }, []);

  return {
    isLoading, error, paged, processed, page: safePage, totalPages,
    search, categoryFilter, sortField, sortDir, selectedIds, allOnPageSelected,
    setSearch, setCategoryFilter, setPage, setSelectedIds,
    handleSort, toggleSelectAll, toggleSelect,
    addSkill, updateSkill, removeSkill, copySkill, removeMultiple,
    retry, clearError,
  };
}
