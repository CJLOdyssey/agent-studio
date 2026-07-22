import { useMemo, useCallback } from 'react';
import type { TeamEntry, TeamFormData, TeamData, TeamCategoryFilter } from './team.types';
import { teamAPI } from './api';
import { useGenericCrud } from '../shared/useGenericCrud';
import { EMPTY_FORM, validateTeamForm } from './validate';

export function useTeamManagement(): TeamData {
  const crud = useGenericCrud<TeamEntry, TeamFormData>({
    api: teamAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'Team',
    validate: validateTeamForm,
    extraFilters: { categoryFilter: 'all', statusFilter: 'all' },
  });

  const addTeam = useCallback(async (data: TeamFormData): Promise<TeamEntry | undefined> => {
    await crud.createItem(data);
    return undefined;
  }, [crud]);

  const updateTeam = useCallback(async (id: string, data: Partial<TeamFormData>) => {
    await crud.updateItem(id, data as Partial<TeamEntry>);
  }, [crud]);

  const deleteTeam = useCallback(async (id: string) => {
    await crud.removeItem(id);
  }, [crud]);

  const copyTeam = useCallback(async (item: TeamEntry) => {
    await crud.cloneItem(item);
  }, [crud]);

  const batchDelete = useCallback(async (ids: Set<string>) => {
    await crud.removeMultipleItems(ids);
  }, [crud]);

  return useMemo(() => ({
    ...crud,
    get teams() { return crud.items; },
    get sortField() { return (crud.sortField ?? 'name') as 'name' | 'status'; },
    get categoryFilter() { return (crud.extraFilterValues.categoryFilter ?? 'all') as TeamCategoryFilter; },
    get statusFilter() { return (crud.extraFilterValues.statusFilter ?? 'all') as 'all' | TeamEntry['status']; },
    setCategoryFilter: (v: TeamCategoryFilter) => crud.setExtraFilter('categoryFilter', v),
    setStatusFilter: (v: 'all' | TeamEntry['status']) => crud.setExtraFilter('statusFilter', v),
    addTeam,
    updateTeam,
    deleteTeam,
    copyTeam,
    batchDelete,
  }), [crud, addTeam, updateTeam, deleteTeam, copyTeam, batchDelete]);
}
