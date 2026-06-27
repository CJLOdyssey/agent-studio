import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SortDir } from '../types';
import type { TeamEntry, TeamFormData } from './team.types';
import { teamAPI } from './api';
import { PAGE_SIZE } from '../constants';

export type TeamSortField = 'name' | 'status';
export type TeamStatusFilter = 'all' | TeamEntry['status'];

export function useTeamData() {
  const [teams, setTeams] = useState<TeamEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('all');
  const [sortField, setSortField] = useState<TeamSortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchTeams = useCallback(() => {
    setIsLoading(true); setError(null);
    setTimeout(() => {
      try { setTeams(teamAPI.fetchAll()); setIsLoading(false); }
      catch { setError('Failed to load teams'); setIsLoading(false); }
    }, 400);
  }, []);
  const retry = useCallback(() => fetchTeams(), [fetchTeams]);
  const clearError = useCallback(() => setError(null), []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const handleSort = useCallback((field: TeamSortField) => {
    setSortField((prev) => { if (prev === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; } setSortDir('asc'); return field; });
    setPage(1);
  }, []);

  const processed = useMemo(() => {
    let arr = [...teams];
    const q = search.toLowerCase();
    if (q) arr = arr.filter((t) => t.name.toLowerCase().includes(q) || t.leader.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    if (statusFilter !== 'all') arr = arr.filter((t) => t.status === statusFilter);
    arr.sort((a, b) => {
      const cmp = a[sortField] < b[sortField] ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [teams, search, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [processed, safePage]);
  const allOnPageSelected = paged.length > 0 && paged.every((t) => selectedIds.has(t.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => paged.every((t) => prev.has(t.id)) ? new Set() : new Set(paged.map((t) => t.id)));
  }, [paged]);

  const addTeam = useCallback((data: TeamFormData) => {
    const created = teamAPI.create(data);
    setTeams((prev) => [created, ...prev]);
    return created;
  }, []);
  const updateTeam = useCallback((id: string, data: TeamFormData) => {
    teamAPI.update(id, data);
    setTeams((prev) => prev.map((t) => t.id === id ? { ...t, ...data } : t));
  }, []);
  const deleteTeam = useCallback((id: string) => {
    teamAPI.remove(id);
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }, []);
  const copyTeam = useCallback((item: TeamEntry) => {
    const cloned = teamAPI.clone(item);
    setTeams((prev) => [cloned, ...prev]);
    setPage(1);
  }, []);
  const batchDelete = useCallback((ids: Set<string>) => {
    teamAPI.removeBatch(ids);
    setTeams((prev) => prev.filter((t) => !ids.has(t.id)));
    setSelectedIds(new Set()); setPage(1);
  }, []);

  return {
    isLoading, error, search, setSearch, statusFilter, setStatusFilter, sortField, sortDir,
    page, setPage, selectedIds, setSelectedIds,
    processed, totalPages: Math.max(1, Math.ceil(processed.length / PAGE_SIZE)), paged,
    allOnPageSelected, toggleSelect, toggleSelectAll,
    handleSort, addTeam, updateTeam, deleteTeam, copyTeam, batchDelete,
    retry, clearError, teams,
  };
}
