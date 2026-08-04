import { useState, useCallback, useMemo } from 'react';
import type { AgentEntry, AgentFormData, StatusFilter } from './agent.types';
import { agentAPI } from './api';
import { validateForm } from './validate';
import { useGenericCrud } from '../shared/useGenericCrud';
import type { GenericCrudReturn } from '../shared/useGenericCrud';
import { PAGE_SIZE } from '../constants';

const EMPTY_FORM: AgentFormData = {
  name: '', description: '', team: '前端团队', model: 'GPT-4o',
  status: 'stopped', version: 'v1.0.0', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [],
};

export interface AgentManagementReturn extends GenericCrudReturn<AgentEntry, AgentFormData> {
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  teamFilter: string;
  setTeamFilter: (v: string) => void;
  batchError: string;
  editingAgent: AgentEntry | null;
  deletingAgent: AgentEntry | null;
  historyAgent: AgentEntry | null;
  handleCopy: (agent: AgentEntry) => void;
  setIsFormOpen: (v: boolean) => void;
  setIsDeleteOpen: (v: boolean) => void;
  setIsBatchDeleteOpen: (v: boolean) => void;
  setIsHistoryOpen: (v: boolean) => void;
}

export function useAgentManagement(): AgentManagementReturn {
  const [batchError, setBatchError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teamFilter, setTeamFilter] = useState('all');

  const crud = useGenericCrud<AgentEntry, AgentFormData>({
    api: agentAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'Agent',
    validate: validateForm,
    sortFields: ['name', 'team', 'status'],
    extraFilters: { status: 'all' },
  });

  // Wrap extra filter to match AgentManagementReturn's setStatusFilter
  const wrappedSetStatusFilter = useCallback((v: StatusFilter) => {
    crud.setExtraFilter('status', v);
    setStatusFilter(v);
  }, [crud]);

  // Team filter: applied AFTER crud's search/sort/filter (teams is an array,
  // so it can't ride the generic extraFilters string-equality path)
  const wrappedSetTeamFilter = useCallback((v: string) => {
    setTeamFilter(v);
    crud.setPage(1);
  }, [crud]);

  const filteredProcessed = useMemo(() => {
    if (teamFilter === 'all') return crud.processed;
    return crud.processed.filter(
      (a) => (a.teams?.length ? a.teams.includes(teamFilter) : a.team === teamFilter),
    );
  }, [crud.processed, teamFilter]);

  const teamTotalPages = Math.max(1, Math.ceil(filteredProcessed.length / PAGE_SIZE));
  const teamSafePage = Math.min(crud.page, teamTotalPages);
  const teamPaged = filteredProcessed.slice(
    (teamSafePage - 1) * PAGE_SIZE,
    teamSafePage * PAGE_SIZE,
  );

  const openDelete = useCallback((agent: AgentEntry) => {
    if (agent.status === 'running') { setBatchError('运行中 Agent 不可删除，请先停止'); setTimeout(() => setBatchError(''), 3000); return; }
    crud.openDelete(agent);
  }, [crud]);

  const handleDelete = useCallback((): Promise<void> | undefined => {
    return crud.handleDelete();
  }, [crud]);

  const handleCopy = useCallback((agent: AgentEntry) => {
    void crud.cloneItem(agent);
  }, [crud]);

  const openBatchDelete = useCallback(() => {
    const running = crud.items.filter((a) => crud.selectedIds.has(a.id) && a.status === 'running');
    if (running.length) { setBatchError(`${running.length} 个运行中 Agent 不可删除，请先停止`); setTimeout(() => setBatchError(''), 3000); return; }
    crud.openBatchDelete();
  }, [crud]);

  const handleBatchDelete = useCallback((): Promise<void> | undefined => {
    return crud.handleBatchDelete();
  }, [crud]);

  const handleSave = useCallback((): Promise<void> | undefined => {
    return crud.handleSave();
  }, [crud]);

  const openEdit = useCallback((agent: AgentEntry) => {
    crud.openEdit(agent);
    if (agent.teams?.length) {
      crud.setFormData((prev) => ({ ...prev, team: agent.teams[0] }));
    }
  }, [crud]);

  return useMemo(() => ({
    ...crud,
    processed: filteredProcessed,
    paged: teamPaged,
    page: teamSafePage,
    totalPages: teamTotalPages,
    statusFilter,
    teamFilter,
    setStatusFilter: wrappedSetStatusFilter,
    setTeamFilter: wrappedSetTeamFilter,
    batchError,
    editingAgent: crud.editingItem,
    deletingAgent: crud.deletingItem,
    historyAgent: crud.historyItem,
    handleSort: (field: keyof AgentEntry) => crud.handleSort(field),
    openEdit,
    handleSave,
    openDelete,
    handleDelete,
    handleCopy,
    openBatchDelete,
    handleBatchDelete,
    setIsFormOpen: () => crud.closeForm(),
    setIsDeleteOpen: () => crud.closeDelete(),
    setIsBatchDeleteOpen: () => crud.closeBatchDelete(),
    setIsHistoryOpen: () => crud.closeHistory(),
  }), [crud, filteredProcessed, teamPaged, teamSafePage, teamTotalPages, statusFilter, teamFilter, wrappedSetStatusFilter, wrappedSetTeamFilter, batchError, openEdit, handleSave, openDelete, handleDelete, handleCopy, openBatchDelete, handleBatchDelete]);
}
