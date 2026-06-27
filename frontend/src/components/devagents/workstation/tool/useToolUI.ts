import { useState, useCallback, useEffect } from 'react';
import type { ToolEntry, ToolFormData } from './tool.types';
import type { ToolData } from './useToolData';

const EMPTY_FORM: ToolFormData = {
  name: '', description: '', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '{"type":"object","properties":{}}',
};

export function validateToolForm(data: ToolFormData, items: ToolEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('工具名称不能为空');
  else if (t.length < 2) errors.push('工具名称至少 2 个字符');
  else if (t.length > 50) errors.push('工具名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  return errors;
}

export interface ToolUI {
  editingItem: ToolEntry | null;
  deletingItem: ToolEntry | null;
  historyItem: ToolEntry | null;
  formData: ToolFormData;
  formErrors: string[];
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;
  setFormData: (fn: (f: ToolFormData) => ToolFormData) => void;
  setOpenMenuId: (id: string | null) => void;
  setMenuAnchorEl: (el: HTMLElement | null) => void;
  openCreate: () => void;
  openEdit: (item: ToolEntry) => void;
  openDelete: (item: ToolEntry) => void;
  openBatchDelete: () => void;
  openHistory: (item: ToolEntry) => void;
  closeForm: () => void;
  closeDelete: () => void;
  closeBatchDelete: () => void;
  closeHistory: () => void;
  closeMenu: () => void;
  save: (d: ToolData) => void;
  confirmDelete: (d: ToolData) => void;
  confirmBatchDelete: (d: ToolData) => void;
}

export function useToolUI(): ToolUI {
  const [formData, setFormData_] = useState<ToolFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<ToolEntry | null>(null);
  const [deletingItem, setDeletingItem] = useState<ToolEntry | null>(null);
  const [historyItem, setHistoryItem] = useState<ToolEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) { setOpenMenuId(null); setMenuAnchorEl(null); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const setFormData = useCallback((fn: (f: ToolFormData) => ToolFormData) => { setFormData_((p) => fn(p)); }, []);
  const openCreate = useCallback(() => { setEditingItem(null); setFormData_(EMPTY_FORM); setFormErrors([]); setIsFormOpen(true); }, []);
  const openEdit = useCallback((item: ToolEntry) => { setEditingItem(item); const { id: _id, createdAt: _createdAt, ...rest } = item; setFormData_(rest); setFormErrors([]); setIsFormOpen(true); }, []);
  const openDelete = useCallback((item: ToolEntry) => { setDeletingItem(item); setFormErrors([]); setIsDeleteOpen(true); }, []);
  const openBatchDelete = useCallback(() => { setIsBatchDeleteOpen(true); }, []);
  const openHistory = useCallback((item: ToolEntry) => { setHistoryItem(item); setIsHistoryOpen(true); }, []);
  const closeForm = useCallback(() => setIsFormOpen(false), []);
  const closeDelete = useCallback(() => setIsDeleteOpen(false), []);
  const closeBatchDelete = useCallback(() => setIsBatchDeleteOpen(false), []);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const closeMenu = useCallback(() => { setOpenMenuId(null); setMenuAnchorEl(null); }, []);

  const save = useCallback((d: ToolData) => {
    const errs = validateToolForm(formData, d.processed, editingItem?.id);
    if (errs.length) { setFormErrors(errs); return; }
    if (editingItem) { d.updateTool(editingItem.id, formData); } else { d.addTool(formData); }
    setIsFormOpen(false);
  }, [formData, editingItem]);

  const confirmDelete = useCallback((d: ToolData) => {
    if (!deletingItem) return;
    d.removeTool(deletingItem.id);
    setDeletingItem(null); setIsDeleteOpen(false);
  }, [deletingItem]);

  const confirmBatchDelete = useCallback((d: ToolData) => {
    d.removeMultiple(d.selectedIds);
    setIsBatchDeleteOpen(false);
  }, []);

  return { editingItem, deletingItem, historyItem, formData, formErrors, isFormOpen, isDeleteOpen, isBatchDeleteOpen, isHistoryOpen, openMenuId, menuAnchorEl, setFormData, setOpenMenuId, setMenuAnchorEl, openCreate, openEdit, openDelete, openBatchDelete, openHistory, closeForm, closeDelete, closeBatchDelete, closeHistory, closeMenu, save, confirmDelete, confirmBatchDelete };
}
