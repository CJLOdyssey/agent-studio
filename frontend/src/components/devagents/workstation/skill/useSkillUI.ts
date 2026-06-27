import { useState, useCallback, useEffect } from 'react';
import type { SkillEntry, SkillFormData } from './skill.types';
import type { SkillData } from './useSkillData';

const EMPTY_FORM: SkillFormData = {
  name: '',
  description: '',
  category: '前端开发',
  status: 'installed',
  version: 'v1.0.0',
  author: '',
  instructions: '',
  prompt_id: '',
  tool_names: [],
  output_constraint: '',
};

export function validateSkillForm(data: SkillFormData, skills: SkillEntry[], editingId?: string): string[] {
  const errors: string[] = [];
  const t = data.name.trim();
  if (!t) errors.push('Skill 名称不能为空');
  else if (t.length < 2) errors.push('Skill 名称至少 2 个字符');
  else if (t.length > 50) errors.push('Skill 名称最多 50 个字符');
  if (skills.some((p) => p.name === t && p.id !== editingId)) errors.push(`名称「${t}」已存在`);
  if (!/^v\d+\.\d+\.\d+$/.test(data.version.trim())) errors.push('版本格式应为 v1.0.0');
  return errors;
}

export interface SkillUI {
  editingSkill: SkillEntry | null;
  deletingSkill: SkillEntry | null;
  historySkill: SkillEntry | null;
  formData: SkillFormData;
  formErrors: string[];
  isFormOpen: boolean;
  isDeleteOpen: boolean;
  isBatchDeleteOpen: boolean;
  isHistoryOpen: boolean;
  openMenuId: string | null;
  menuAnchorEl: HTMLElement | null;
  setFormData: (fn: (f: SkillFormData) => SkillFormData) => void;
  setOpenMenuId: (v: string | null) => void;
  setMenuAnchorEl: (v: HTMLElement | null) => void;
  openCreate: () => void;
  openEdit: (skill: SkillEntry) => void;
  openDelete: (skill: SkillEntry) => void;
  openBatchDelete: () => void;
  openHistory: (skill: SkillEntry) => void;
  closeForm: () => void;
  closeDelete: () => void;
  closeBatchDelete: () => void;
  closeHistory: () => void;
  closeMenu: () => void;
  save: (data: SkillData) => void;
  confirmDelete: (data: SkillData) => void;
  confirmBatchDelete: (data: SkillData) => void;
}

export function useSkillUI(): SkillUI {
  const [formData, setFormData_] = useState<SkillFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingSkill, setEditingSkill] = useState<SkillEntry | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<SkillEntry | null>(null);
  const [historySkill, setHistorySkill] = useState<SkillEntry | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!openMenuId) { setMenuAnchorEl(null); return; }
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) {
        setOpenMenuId(null);
        setMenuAnchorEl(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const setFormData = useCallback((fn: (f: SkillFormData) => SkillFormData) => {
    setFormData_((prev) => fn(prev));
  }, []);

  const openCreate = useCallback(() => {
    setEditingSkill(null);
    setFormData_(EMPTY_FORM);
    setFormErrors([]);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((skill: SkillEntry) => {
    setEditingSkill(skill);
    const { id, createdAt, ...rest } = skill;
    setFormData_(rest);
    setFormErrors([]);
    setIsFormOpen(true);
  }, []);

  const openDelete = useCallback((skill: SkillEntry) => {
    setDeletingSkill(skill);
    setFormErrors([]);
    setIsDeleteOpen(true);
  }, []);

  const openBatchDelete = useCallback(() => {
    setIsBatchDeleteOpen(true);
  }, []);

  const openHistory = useCallback((skill: SkillEntry) => {
    setHistorySkill(skill);
    setIsHistoryOpen(true);
  }, []);

  const closeForm = useCallback(() => setIsFormOpen(false), []);
  const closeDelete = useCallback(() => setIsDeleteOpen(false), []);
  const closeBatchDelete = useCallback(() => setIsBatchDeleteOpen(false), []);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);
  const closeMenu = useCallback(() => { setOpenMenuId(null); setMenuAnchorEl(null); }, []);

  const save = useCallback((d: SkillData) => {
    const errs = validateSkillForm(formData, d.processed, editingSkill?.id);
    if (errs.length) { setFormErrors(errs); return; }
    if (editingSkill) {
      d.updateSkill(editingSkill.id, formData);
    } else {
      d.addSkill(formData);
    }
    setIsFormOpen(false);
  }, [formData, editingSkill]);

  const confirmDelete = useCallback((d: SkillData) => {
    if (!deletingSkill) return;
    d.removeSkill(deletingSkill.id);
    setDeletingSkill(null);
    setIsDeleteOpen(false);
  }, [deletingSkill]);

  const confirmBatchDelete = useCallback((d: SkillData) => {
    d.removeMultiple(d.selectedIds);
    setIsBatchDeleteOpen(false);
  }, []);

  return {
    editingSkill, deletingSkill, historySkill,
    formData, formErrors,
    isFormOpen, isDeleteOpen, isBatchDeleteOpen, isHistoryOpen,
    openMenuId, menuAnchorEl,
    setFormData, setOpenMenuId, setMenuAnchorEl,
    openCreate, openEdit, openDelete, openBatchDelete, openHistory,
    closeForm, closeDelete, closeBatchDelete, closeHistory, closeMenu,
    save, confirmDelete, confirmBatchDelete,
  };
}
