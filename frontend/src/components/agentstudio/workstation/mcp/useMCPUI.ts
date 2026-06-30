import { useState, useCallback, useEffect } from 'react';
import type { MCPEntry, MCPFormData } from './mcp.types';
import type { MCPData } from './useMCPData';

const EMPTY_FORM: MCPFormData = {
  name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: '', url: '',
};

export function validateMCPForm(data: MCPFormData, items: MCPEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('MCP 名称不能为空');
  else if (t.length < 2) errors.push('MCP 名称至少 2 个字符');
  else if (t.length > 50) errors.push('MCP 名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  if (data.type === 'stdio' && !data.command.trim()) errors.push('stdio 类型需要填写启动命令');
  if (data.type === 'sse' && !data.url.trim()) errors.push('sse 类型需要填写服务地址');
  return errors;
}

export interface MCPUI {
  editingItem: MCPEntry | null;
  deletingItem: MCPEntry | null;
  historyItem: MCPEntry | null;
  formData: MCPFormData;
  formErrors: string[];
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;
  setFormData: (fn: (f: MCPFormData) => MCPFormData) => void;
  setOpenMenuId: (id: string | null) => void;
  setMenuAnchorEl: (el: HTMLElement | null) => void;
  openCreate: () => void;
  openEdit: (item: MCPEntry) => void;
  openDelete: (item: MCPEntry) => void;
  openBatchDelete: () => void;
  openHistory: (item: MCPEntry) => void;
  closeForm: () => void;
  closeDelete: () => void;
  closeBatchDelete: () => void;
  closeHistory: () => void;
  save: (d: MCPData) => void;
  confirmDelete: (d: MCPData) => void;
  confirmBatchDelete: (d: MCPData) => void;
}

export function useMCPUI(): MCPUI {
  const [formData, setFormData_] = useState<MCPFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<MCPEntry | null>(null);
  const [deletingItem, setDeletingItem] = useState<MCPEntry | null>(null);
  const [historyItem, setHistoryItem] = useState<MCPEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!openMenuId) { setMenuAnchorEl(null); return; }
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) { setOpenMenuId(null); setMenuAnchorEl(null); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const setFormData = useCallback((fn: (f: MCPFormData) => MCPFormData) => { setFormData_((p) => fn(p)); }, []);
  const openCreate = useCallback(() => { setEditingItem(null); setFormData_(EMPTY_FORM); setFormErrors([]); setIsFormOpen(true); }, []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openEdit = useCallback((item: MCPEntry) => { setEditingItem(item); const { id, createdAt, ...rest } = item; setFormData_(rest); setFormErrors([]); setIsFormOpen(true); }, []);
  const openDelete = useCallback((item: MCPEntry) => { setDeletingItem(item); setFormErrors([]); setIsDeleteOpen(true); }, []);
  const openBatchDelete = useCallback(() => { setIsBatchDeleteOpen(true); }, []);
  const openHistory = useCallback((item: MCPEntry) => { setHistoryItem(item); setIsHistoryOpen(true); }, []);
  const closeForm = useCallback(() => setIsFormOpen(false), []);
  const closeDelete = useCallback(() => setIsDeleteOpen(false), []);
  const closeBatchDelete = useCallback(() => setIsBatchDeleteOpen(false), []);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);

  const save = useCallback((d: MCPData) => {
    const errs = validateMCPForm(formData, d.processed, editingItem?.id);
    if (errs.length) { setFormErrors(errs); return; }
    editingItem ? d.updateMCP(editingItem.id, formData) : d.addMCP(formData); // eslint-disable-line @typescript-eslint/no-unused-expressions
    setIsFormOpen(false);
  }, [formData, editingItem]);

  const confirmDelete = useCallback((d: MCPData) => {
    if (!deletingItem) return;
    d.removeMCP(deletingItem.id);
    setDeletingItem(null); setIsDeleteOpen(false);
  }, [deletingItem]);

  const confirmBatchDelete = useCallback((d: MCPData) => {
    d.removeMultiple(d.selectedIds);
    setIsBatchDeleteOpen(false);
  }, []);

  return { editingItem, deletingItem, historyItem, formData, formErrors, isFormOpen, isDeleteOpen, isBatchDeleteOpen, isHistoryOpen, openMenuId, menuAnchorEl, setFormData, setOpenMenuId, setMenuAnchorEl, openCreate, openEdit, openDelete, openBatchDelete, openHistory, closeForm, closeDelete, closeBatchDelete, closeHistory, save, confirmDelete, confirmBatchDelete };
}
