import { useMemo, useCallback } from 'react';
import type { MCPEntry, MCPFormData, MCPData } from './mcp.types';
import { mcpAPI } from './api';
import { useGenericCrud } from '../shared/useGenericCrud';
import { EMPTY_FORM, validateMCPForm } from './validate';

export function useMcpManagement(): MCPData {
  const crud = useGenericCrud<MCPEntry, MCPFormData>({
    api: mcpAPI,
    emptyForm: EMPTY_FORM,
    itemName: 'MCP',
    validate: validateMCPForm,
    extraFilters: { type: 'all', status: 'all' },
  });

  const addMCP = useCallback(async (data: MCPFormData) => { await crud.createItem(data); }, [crud]);
  const updateMCP = useCallback(async (id: string, data: Partial<MCPEntry>) => { await crud.updateItem(id, data); }, [crud]);
  const removeMCP = useCallback(async (id: string) => { await crud.removeItem(id); }, [crud]);
  const copyMCP = useCallback(async (item: MCPEntry) => { await crud.cloneItem(item); }, [crud]);
  const removeMultiple = useCallback(async (ids: Set<string>) => { await crud.removeMultipleItems(ids); }, [crud]);

  return useMemo(() => ({
    ...crud,
    get typeFilter() { return crud.extraFilterValues.type ?? 'all'; },
    get statusFilter() { return crud.extraFilterValues.status ?? 'all'; },
    setTypeFilter: (v: string) => crud.setExtraFilter('type', v),
    setStatusFilter: (v: string) => crud.setExtraFilter('status', v),
    addMCP, updateMCP, removeMCP, copyMCP, removeMultiple,
  }), [crud, addMCP, updateMCP, removeMCP, copyMCP, removeMultiple]);
}
