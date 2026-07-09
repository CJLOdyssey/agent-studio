import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { SortDir } from '../types';
import type { MCPEntry, MCPFormData } from './mcp.types';
import { mcpAPI } from './api';
import { PAGE_SIZE } from '../constants';

export type MCPSortField = 'name' | 'type' | 'status';
export type TypeFilter = 'all' | string;
export type MCPStatusFilter = 'all' | MCPEntry['status'];

export interface MCPData {
  isLoading: boolean; error: string | null;
  paged: MCPEntry[]; processed: MCPEntry[];
  page: number; totalPages: number;
  search: string; typeFilter: TypeFilter; statusFilter: MCPStatusFilter;
  sortField: MCPSortField | null; sortDir: SortDir;
  selectedIds: Set<string>; allOnPageSelected: boolean;
  setSearch: (v: string) => void; setTypeFilter: (v: TypeFilter) => void; setStatusFilter: (v: MCPStatusFilter) => void;
  setPage: (v: number) => void;
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  handleSort: (field: MCPSortField) => void;
  toggleSelectAll: () => void; toggleSelect: (id: string) => void;
  addMCP: (data: MCPFormData) => void;
  updateMCP: (id: string, data: Partial<MCPEntry>) => void;
  removeMCP: (id: string) => void; copyMCP: (item: MCPEntry) => void;
  removeMultiple: (ids: Set<string>) => void; clearError: () => void; retry: () => void;
}

export function useMCPData(): MCPData {
  const [items, setItems] = useState<MCPEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<MCPStatusFilter>('all');
  const [sortField, setSortField] = useState<MCPSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  const load = useCallback(() => {
    setIsLoading(true); setError(null);
    cancelledRef.current = false;
    mcpAPI.fetchAll()
      .then((data) => { if (!cancelledRef.current) setItems(data); })
      .catch((e) => { if (!cancelledRef.current) setError(`加载失败：${(e as Error).message}`); })
      .finally(() => { if (!cancelledRef.current) setIsLoading(false); });
    return () => { cancelledRef.current = true; };
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const c = load(); return c; }, [load]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, typeFilter, statusFilter, sortField, sortDir]);

  const processed = useMemo(() => {
    let r = typeFilter === 'all' ? items : items.filter((s) => s.type === typeFilter);
    if (statusFilter !== 'all') r = r.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q),
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
  }, [items, search, typeFilter, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [processed, safePage]);
  const allOnPageSelected = paged.length > 0 && paged.every((i) => selectedIds.has(i.id));

  const handleSort = useCallback((field: MCPSortField) => { setSortField((prev) => { if (prev === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; } setSortDir('asc'); return field; }); setPage(1); }, []);
  const toggleSelect = useCallback((id: string) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleSelectAll = useCallback(() => setSelectedIds((prev) => paged.every((i) => prev.has(i.id)) ? new Set() : new Set(paged.map((i) => i.id))), [paged]);

  const addMCP = useCallback((data: MCPFormData) => { const item = { ...data, id: `mcp-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) }; setItems((prev) => [item as MCPEntry, ...prev]); mcpAPI.create(data).catch(() => {}); }, []);
  const updateMCP = useCallback((id: string, data: Partial<MCPEntry>) => { setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...data } : i)); mcpAPI.update(id, data).catch(() => {}); }, []);
  const removeMCP = useCallback((id: string) => { setItems((prev) => prev.filter((i) => i.id !== id)); setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); mcpAPI.remove(id).catch(() => {}); }, []);
  const copyMCP = useCallback((item: MCPEntry) => { const copy = { ...item, id: `mcp-${Date.now()}`, name: `${item.name.slice(0, 60)} (副本)`, createdAt: new Date().toISOString().slice(0, 10) }; setItems((prev) => [copy, ...prev]); mcpAPI.clone(item).catch(() => {}); }, []);
  const removeMultiple = useCallback((ids: Set<string>) => { setItems((prev) => prev.filter((i) => !ids.has(i.id))); setSelectedIds(new Set()); setPage(1); mcpAPI.removeBatch(ids).catch(() => {}); }, []);

  const clearError = useCallback(() => setError(null), []);
  const retry = useCallback(() => { load(); }, [load]);

  return {
    isLoading, error, search, setSearch, typeFilter, setTypeFilter, statusFilter, setStatusFilter,
    sortField, sortDir, page, setPage, selectedIds, setSelectedIds,
    processed, totalPages, paged, allOnPageSelected, toggleSelect, toggleSelectAll,
    handleSort, addMCP, updateMCP, removeMCP, copyMCP, removeMultiple,
    clearError, retry,
  };
}
