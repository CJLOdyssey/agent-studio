import { useState, useCallback, useEffect } from 'react';
import type { OutputCategory, OutputEntry, OutputFormData } from './output.types';

const EMPTY_FORM: OutputFormData = {
  name: '', content: '', category: '格式约束' as OutputCategory, model: '全部模型', status: 'draft', version: 'v1.0.0',
};

function validateForm(data: OutputFormData): string[] {
  const e: string[] = [];
  const n = data.name.trim();
  if (!n || n.length < 2) e.push(n ? '至少2个字符' : '名称不能为空');
  if (n.length > 50) e.push('最多50个字符');
  if (!data.content.trim()) e.push('内容不能为空');
  return e;
}

export interface OutputUI {
  editingItem: OutputEntry | null; editingId: string | null;
  formData: OutputFormData; formErrors: string[]; isFormOpen: boolean;
  openMenuId: string | null; menuAnchorEl: HTMLElement | null;
  setFormData: (fn: (f: OutputFormData) => OutputFormData) => void;
  setOpenMenuId: (id: string | null) => void;
  setMenuAnchorEl: (el: HTMLElement | null) => void;
  openCreate: () => void; openEdit: (item: OutputEntry) => void;
  closeForm: () => void;
  handleSave: (d: { addItem: (data: OutputFormData) => Promise<void>; updateItem: (id: string, data: Partial<OutputEntry>) => Promise<void>; editingId: string | null }) => boolean;
}

export function useOutputUI(): OutputUI {
  const [formData, setFormData_] = useState<OutputFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<OutputEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!openMenuId) { setMenuAnchorEl(null); return; }
    function h(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) { setOpenMenuId(null); setMenuAnchorEl(null); }
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [openMenuId]);

  const setFormData = useCallback((fn: (f: OutputFormData) => OutputFormData) => { setFormData_((p) => fn(p)); }, []);
  const openCreate = useCallback(() => { setEditingItem(null); setFormData_(EMPTY_FORM); setFormErrors([]); setIsFormOpen(true); }, []);
  const openEdit = useCallback((item: OutputEntry) => { setEditingItem(item); setFormData_({ name: item.name, content: item.content, category: item.category, model: item.model, status: item.status, version: item.version }); setFormErrors([]); setIsFormOpen(true); }, []);
  const closeForm = useCallback(() => { setIsFormOpen(false); setFormErrors([]); }, []);

  const handleSave = useCallback((d: { addItem: (data: OutputFormData) => Promise<void>; updateItem: (id: string, data: Partial<OutputEntry>) => Promise<void>; editingId: string | null }): boolean => {
    const errs = validateForm(formData);
    if (errs.length) { setFormErrors(errs); return false; }
    if (d.editingId) d.updateItem(d.editingId, formData);
    else d.addItem(formData);
    setIsFormOpen(false);
    return true;
  }, [formData]);

  return {
    editingItem, editingId: editingItem?.id ?? null, formData, formErrors, isFormOpen,
    openMenuId, menuAnchorEl, setFormData, setOpenMenuId, setMenuAnchorEl,
    openCreate, openEdit, closeForm, handleSave,
  };
}
