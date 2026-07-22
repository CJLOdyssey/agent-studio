import { useState, useMemo, useCallback, useEffect } from 'react';
import type { SortDir } from '../types';
import type { AgentEntry, AgentFormData, SortField, StatusFilter } from './agent.types';
import { agentAPI } from './api';
import { validateForm } from './validate';
import { PAGE_SIZE } from '../constants';

const EMPTY_FORM: AgentFormData = {
  name: '', description: '', team: '前端团队', model: 'GPT-4o',
  status: 'stopped', version: 'v1.0.0', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [],
};

export interface AgentManagementReturn {
  isLoading: boolean;
  error: string | null;
  paged: AgentEntry[];
  processed: AgentEntry[];
  page: number;
  totalPages: number;
  search: string;
  statusFilter: StatusFilter;
  sortField: SortField | null;
  sortDir: SortDir;
  selectedIds: Set<string>;
  allOnPageSelected: boolean;
  formErrors: string[];
  batchError: string;
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  editingAgent: AgentEntry | null;
  deletingAgent: AgentEntry | null;
  historyAgent: AgentEntry | null;
  formData: AgentFormData;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;
  setFormData: (d: AgentFormData) => void;
  setSearch: (v: string) => void;
  setStatusFilter: (v: StatusFilter) => void;
  setPage: (v: number) => void;
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setOpenMenuId: (v: string | null) => void;
  setMenuAnchorEl: (v: HTMLElement | null) => void;
  handleSort: (field: SortField) => void;
  toggleSelectAll: () => void;
  toggleSelect: (id: string) => void;
  openCreate: () => void;
  openEdit: (agent: AgentEntry) => void;
  handleSave: () => void;
  openDelete: (agent: AgentEntry) => void;
  handleDelete: () => void;
  handleCopy: (agent: AgentEntry) => void;
  openHistory: (agent: AgentEntry) => void;
  openBatchDelete: () => void;
  handleBatchDelete: () => void;
  closeMenu: () => void;
  setIsFormOpen: (v: boolean) => void;
  setIsDeleteOpen: (v: boolean) => void;
  setIsBatchDeleteOpen: (v: boolean) => void;
  setIsHistoryOpen: (v: boolean) => void;
  retry: () => void;
  clearError: () => void;
}

export function useAgentManagement(): AgentManagementReturn {
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [batchError, setBatchError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentEntry | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AgentEntry | null>(null);
  const [historyAgent, setHistoryAgent] = useState<AgentEntry | null>(null);
  const [formData, setFormData] = useState<AgentFormData>(EMPTY_FORM);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  const fetchAgents = useCallback(() => {
    setIsLoading(true); setError(null);
    setTimeout(() => {
      agentAPI.fetchAll().then((items) => {
        setAgents(items); setIsLoading(false);
      }).catch(() => {
        setError('Failed to load agents'); setIsLoading(false);
      });
    }, 400);
  }, []);
  const retry = useCallback(() => fetchAgents(), [fetchAgents]);
  const clearError = useCallback(() => setError(null), []);
  const closeMenu = useCallback(() => { setOpenMenuId(null); setMenuAnchorEl(null); }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!openMenuId) { setMenuAnchorEl(null); return; }
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) closeMenu();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId, closeMenu]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, statusFilter, sortField, sortDir]);

  const processed = useMemo(() => {
    let result = statusFilter === 'all' ? agents : agents.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q) || a.team.toLowerCase().includes(q) || a.model.toLowerCase().includes(q));
    }
    if (sortField) {
      result.sort((a, b) => {
        const cmp = a[sortField].localeCompare(b[sortField]);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [agents, search, statusFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const allOnPageSelected = paged.length > 0 && paged.every((a) => selectedIds.has(a.id));

  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => { if (prev === field) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; } setSortDir('asc'); return field; });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach((a) => next.delete(a.id));
      else paged.forEach((a) => next.add(a.id));
      return next;
    });
  }, [allOnPageSelected, paged]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const openCreate = useCallback(() => { setEditingAgent(null); setFormData(EMPTY_FORM); setFormErrors([]); setIsFormOpen(true); }, []);
  const openEdit = useCallback((agent: AgentEntry) => { setEditingAgent(agent); setFormData({ name: agent.name, description: agent.description, team: agent.team, model: agent.model, status: agent.status, version: agent.version, systemPromptId: agent.systemPromptId, toolIds: agent.toolIds, mcpIds: agent.mcpIds, skillIds: agent.skillIds }); setFormErrors([]); setIsFormOpen(true); }, []);

  const handleSave = useCallback(async () => {
    const errs = validateForm(formData, agents, editingAgent?.id);
    if (errs.length) { setFormErrors(errs); return; }
    try {
      if (editingAgent) { await agentAPI.update(editingAgent.id, formData); setAgents((p) => p.map((a) => (a.id === editingAgent.id ? { ...a, ...formData } : a))); }
      else { const created = await agentAPI.create(formData); setAgents((p) => [...p, created]); }
      setIsFormOpen(false);
    } catch (e) { setFormErrors([`操作失败：${(e as Error).message}`]); }
  }, [formData, editingAgent, agents]);

  const openDelete = useCallback((agent: AgentEntry) => {
    if (agent.status === 'running') { setBatchError('运行中 Agent 不可删除，请先停止'); setTimeout(() => setBatchError(''), 3000); return; }
    setDeletingAgent(agent); setIsDeleteOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingAgent) return;
    try {
      await agentAPI.remove(deletingAgent.id);
      setAgents((prev) => prev.filter((a) => a.id !== deletingAgent.id));
      setIsDeleteOpen(false); setDeletingAgent(null);
    } catch (e) { setBatchError(`删除失败：${(e as Error).message}`); }
  }, [deletingAgent]);

  const handleCopy = useCallback((agent: AgentEntry) => {
    agentAPI.clone(agent).then((cloned) => setAgents((prev) => [...prev, cloned]));
  }, []);

  const openHistory = useCallback((agent: AgentEntry) => { setHistoryAgent(agent); setIsHistoryOpen(true); }, []);

  const openBatchDelete = useCallback(() => {
    const running = agents.filter((a) => selectedIds.has(a.id) && a.status === 'running');
    if (running.length) { setBatchError(`${running.length} 个运行中 Agent 不可删除，请先停止`); setTimeout(() => setBatchError(''), 3000); return; }
    setIsBatchDeleteOpen(true);
  }, [agents, selectedIds]);

  const handleBatchDelete = useCallback(async () => {
    try {
      await agentAPI.removeBatch(selectedIds);
      setAgents((prev) => prev.filter((a) => !selectedIds.has(a.id)));
      setSelectedIds(new Set()); setIsBatchDeleteOpen(false);
    } catch (e) { setBatchError(`批量删除失败：${(e as Error).message}`); }
  }, [selectedIds]);

  return {
    isLoading, error, paged, processed, page: safePage, totalPages,
    search, statusFilter, sortField, sortDir, selectedIds, allOnPageSelected,
    formErrors, batchError,
    isFormOpen, isDeleteOpen, isBatchDeleteOpen, isHistoryOpen,
    editingAgent, deletingAgent, historyAgent, formData,
    openMenuId, menuAnchorEl,
    setFormData, setSearch, setStatusFilter, setPage, setSelectedIds,
    setOpenMenuId, setMenuAnchorEl,
    handleSort, toggleSelectAll, toggleSelect,
    openCreate, openEdit, handleSave, openDelete, handleDelete,
    handleCopy, openHistory, openBatchDelete, handleBatchDelete, closeMenu,
    setIsFormOpen, setIsDeleteOpen, setIsBatchDeleteOpen, setIsHistoryOpen,
    retry, clearError,
  };
}
