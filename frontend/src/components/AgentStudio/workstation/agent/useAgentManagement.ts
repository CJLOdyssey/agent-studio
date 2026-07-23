import { useState, useCallback } from 'react';
import type { SortDir } from '../types';
import type { AgentEntry, AgentFormData, SortField, StatusFilter } from './agent.types';
import { agentAPI } from './api';
import { validateForm } from './validate';
import { useGenericCrud } from '../shared/useGenericCrud';

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
  const [batchError, setBatchError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const crud = useGenericCrud<AgentEntry, AgentFormData>({
    api: agentAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'Agent',
    validate: validateForm,
    sortFields: ['name', 'team', 'status'],
    extraFilters: { statusFilter: 'all' },
  });

  // Wrap extra filter to match AgentManagementReturn's setStatusFilter
  const wrappedSetStatusFilter = useCallback((v: StatusFilter) => {
    crud.setExtraFilter('statusFilter', v);
    setStatusFilter(v);
  }, [crud]);

  const openDelete = useCallback((agent: AgentEntry) => {
    if (agent.status === 'running') { setBatchError('运行中 Agent 不可删除，请先停止'); setTimeout(() => setBatchError(''), 3000); return; }
    crud.openDelete(agent);
  }, [crud]);

  const handleDelete = useCallback(async () => {
    try {
      if (crud.deletingItem) {
        await crud.removeItem(crud.deletingItem.id);
        crud.closeDelete();
      }
    } catch (e) { setBatchError(`删除失败：${(e as Error).message}`); }
  }, [crud]);

  const handleCopy = useCallback((agent: AgentEntry) => {
    crud.cloneItem(agent);
  }, [crud]);

  const openBatchDelete = useCallback(() => {
    const running = crud.items.filter((a) => crud.selectedIds.has(a.id) && a.status === 'running');
    if (running.length) { setBatchError(`${running.length} 个运行中 Agent 不可删除，请先停止`); setTimeout(() => setBatchError(''), 3000); return; }
    crud.openBatchDelete();
  }, [crud]);

  const handleBatchDelete = useCallback(async () => {
    try {
      await crud.removeMultipleItems(crud.selectedIds);
      crud.closeBatchDelete();
    } catch (e) { setBatchError(`批量删除失败：${(e as Error).message}`); }
  }, [crud]);

  const handleSave = useCallback(() => {
    crud.handleSave();
    if (crud.formErrors.length === 0) {
      // close happens inside useGenericCrud's handleSave on success
    }
  }, [crud]);

  return {
    isLoading: crud.isLoading,
    error: crud.error,
    paged: crud.paged as AgentEntry[],
    processed: crud.processed as AgentEntry[],
    page: crud.page,
    totalPages: crud.totalPages,
    search: crud.search,
    statusFilter,
    sortField: crud.sortField as SortField | null,
    sortDir: crud.sortDir,
    selectedIds: crud.selectedIds,
    allOnPageSelected: crud.allOnPageSelected,
    formErrors: crud.formErrors,
    batchError,
    isFormOpen: crud.isFormOpen,
    isDeleteOpen: crud.isDeleteOpen,
    isBatchDeleteOpen: crud.isBatchDeleteOpen,
    isHistoryOpen: crud.isHistoryOpen,
    editingAgent: crud.editingItem as AgentEntry | null,
    deletingAgent: crud.deletingItem as AgentEntry | null,
    historyAgent: crud.historyItem as AgentEntry | null,
    formData: crud.formData as AgentFormData,
    openMenuId: crud.openMenuId,
    menuAnchorEl: crud.menuAnchorEl,
    setFormData: (d: AgentFormData) => crud.setFormData(() => d),
    setSearch: crud.setSearch,
    setStatusFilter: wrappedSetStatusFilter,
    setPage: crud.setPage,
    setSelectedIds: crud.setSelectedIds,
    setOpenMenuId: crud.setOpenMenuId,
    setMenuAnchorEl: crud.setMenuAnchorEl,
    handleSort: (field: SortField) => crud.handleSort(field as keyof AgentEntry),
    toggleSelectAll: crud.toggleSelectAll,
    toggleSelect: crud.toggleSelect,
    openCreate: crud.openCreate,
    openEdit: (agent: AgentEntry) => crud.openEdit(agent),
    handleSave,
    openDelete,
    handleDelete,
    handleCopy,
    openHistory: (agent: AgentEntry) => crud.openHistory(agent),
    openBatchDelete,
    handleBatchDelete,
    closeMenu: crud.closeMenu,
    setIsFormOpen: () => crud.closeForm(),
    setIsDeleteOpen: () => crud.closeDelete(),
    setIsBatchDeleteOpen: () => crud.closeBatchDelete(),
    setIsHistoryOpen: () => crud.closeHistory(),
    retry: crud.retry,
    clearError: crud.clearError,
  };
}
