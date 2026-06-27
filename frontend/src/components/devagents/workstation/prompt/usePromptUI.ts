import { useState, useCallback, useEffect } from 'react';
import type { PromptEntry, PromptFormData } from './types';
import type { PromptData } from './types';

const EMPTY_FORM: PromptFormData = {
  name: '', content: '', category: '系统提示词', model: 'GPT-4o', status: 'draft', version: 'v1.0.0',
};

export function validatePromptForm(data: PromptFormData, items: PromptEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('提示词名称不能为空');
  else if (t.length < 2) errors.push('提示词名称至少 2 个字符');
  else if (t.length > 50) errors.push('提示词名称最多 50 个字符');
  if (items.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!data.content.trim()) errors.push('提示词内容不能为空');
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  return errors;
}

export interface PromptUI {
  editingItem: PromptEntry | null;
  deletingItem: PromptEntry | null;
  historyItem: PromptEntry | null;
  formData: PromptFormData;
  formErrors: string[];
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;
  setFormData: (fn: (f: PromptFormData) => PromptFormData) => void;
  setOpenMenuId: (id: string | null) => void;
  setMenuAnchorEl: (el: HTMLElement | null) => void;
  openCreate: () => void;
  openEdit: (item: PromptEntry) => void;
  openDelete: (item: PromptEntry) => void;
  openBatchDelete: () => void;
  openHistory: (item: PromptEntry) => void;
  closeForm: () => void;
  closeDelete: () => void;
  closeBatchDelete: () => void;
  closeHistory: () => void;
  closeMenu: () => void;
  save: (d: PromptData) => void;
  confirmDelete: (d: PromptData) => void;
  confirmBatchDelete: (d: PromptData) => void;
}

export function usePromptUI(): PromptUI {
  const [formData, setFormData_] = useState<PromptFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<PromptEntry | null>(null);
  const [deletingItem, setDeletingItem] = useState<PromptEntry | null>(null);
  const [historyItem, setHistoryItem] = useState<PromptEntry | null>(null);
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

  const setFormData = useCallback((fn: (f: PromptFormData) => PromptFormData) => { setFormData_((p) => fn(p)); }, []);
  const openCreate = useCallback(() => { setEditingItem(null); setFormData_(EMPTY_FORM); setFormErrors([]); setIsFormOpen(true); }, []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const openEdit = useCallback((item: PromptEntry) => { setEditingItem(item); const { id, createdAt, ...rest } = item; setFormData_(rest); setFormErrors([]); setIsFormOpen(true); }, []);
  const openDelete = useCallback((item: PromptEntry) => { setDeletingItem(item); setFormErrors([]); setIsDeleteOpen(true); }, []);
  const openBatchDelete = useCallback(() => { setIsBatchDeleteOpen(true); }, []);
  const openHistory = useCallback((item: PromptEntry) => { setHistoryItem(item); setIsHistoryOpen(true); }, []);
  const closeForm = useCallback(() => setIsFormOpen(false), []);
  const closeDelete = useCallback(() => setIsDeleteOpen(false), []);
  const closeBatchDelete = useCallback(() => setIsBatchDeleteOpen(false), []);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const closeMenu = useCallback(() => { setOpenMenuId(null); setMenuAnchorEl(null); }, []);

  const save = useCallback((d: PromptData) => {
    const errs = validatePromptForm(formData, d.processed, editingItem?.id);
    if (errs.length) { setFormErrors(errs); return; }
    editingItem ? d.updatePrompt(editingItem.id, formData) : d.addPrompt(formData); // eslint-disable-line @typescript-eslint/no-unused-expressions
    setIsFormOpen(false);
  }, [formData, editingItem]);

  const confirmDelete = useCallback((d: PromptData) => {
    if (!deletingItem) return;
    d.removePrompt(deletingItem.id);
    setDeletingItem(null); setIsDeleteOpen(false);
  }, [deletingItem]);

  const confirmBatchDelete = useCallback((d: PromptData) => {
    d.removeMultiple(d.selectedIds);
    setIsBatchDeleteOpen(false);
  }, []);

  return { editingItem, deletingItem, historyItem, formData, formErrors, isFormOpen, isDeleteOpen, isBatchDeleteOpen, isHistoryOpen, openMenuId, menuAnchorEl, setFormData, setOpenMenuId, setMenuAnchorEl, openCreate, openEdit, openDelete, openBatchDelete, openHistory, closeForm, closeDelete, closeBatchDelete, closeHistory, closeMenu, save, confirmDelete, confirmBatchDelete };
}
