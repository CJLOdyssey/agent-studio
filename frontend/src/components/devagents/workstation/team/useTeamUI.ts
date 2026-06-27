import { useState, useCallback, useEffect } from 'react';
import type { TeamEntry, TeamFormData } from './team.types';

export function useTeamUI() {
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamEntry | null>(null);
  const [formData, setFormDataRaw] = useState<TeamFormData>({ name: '', description: '', leader: '', memberCount: 1, status: 'active' });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<TeamEntry | null>(null);
  const [isBatchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<TeamEntry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!openMenuId) { setMenuAnchorEl(null); return; }
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.wsta-dropdown-portal')) { setOpenMenuId(null); setMenuAnchorEl(null); }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenuId]);

  const setFormData = useCallback((fn: (f: TeamFormData) => TeamFormData) => setFormDataRaw(fn), []);
  const closeMenu = useCallback(() => { setOpenMenuId(null); setMenuAnchorEl(null); }, []);

  function openCreate() {
    setEditingItem(null); setFormDataRaw({ name: '', description: '', leader: '', memberCount: 1, status: 'active' }); setFormErrors([]); setFormOpen(true);
  }
  function openEdit(item: TeamEntry) {
    setEditingItem(item); setFormDataRaw({ name: item.name, description: item.description, leader: item.leader, memberCount: item.memberCount, status: item.status }); setFormErrors([]); setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditingItem(null); setFormErrors([]); }
  function validate() { const errs: string[] = []; if (!formData.name.trim()) errs.push('团队名称不能为空'); else if (formData.name.length < 2 || formData.name.length > 50) errs.push('团队名称长度需在 2-50 个字符之间'); if (!formData.leader.trim()) errs.push('负责人不能为空'); if (formData.memberCount < 1) errs.push('成员数至少为 1'); setFormErrors(errs); return errs.length === 0; }
  function save(data: ReturnType<typeof import('./useTeamData').useTeamData>) { if (!validate()) return; if (editingItem) data.updateTeam(editingItem.id, formData); else data.addTeam(formData); closeForm(); }
  function openDelete(item: TeamEntry) { setDeletingItem(item); setDeleteOpen(true); }
  function closeDelete() { setDeletingItem(null); setDeleteOpen(false); }
  function confirmDelete(data: ReturnType<typeof import('./useTeamData').useTeamData>) { if (deletingItem) data.deleteTeam(deletingItem.id); closeDelete(); }
  function openBatchDelete() { setBatchDeleteOpen(true); }
  function closeBatchDelete() { setBatchDeleteOpen(false); }
  function confirmBatchDelete(data: ReturnType<typeof import('./useTeamData').useTeamData>) { data.batchDelete(data.selectedIds); closeBatchDelete(); }
  function openHistory(item: TeamEntry) { setHistoryItem(item); setHistoryOpen(true); }
  function closeHistory() { setHistoryItem(null); setHistoryOpen(false); }

  return {
    isFormOpen, editingItem, formData, setFormData, formErrors,
    isDeleteOpen, deletingItem, isBatchDeleteOpen, isHistoryOpen, historyItem,
    openMenuId, menuAnchorEl, setOpenMenuId, setMenuAnchorEl, closeMenu,
    openCreate, openEdit, closeForm, save,
    openDelete, closeDelete, confirmDelete,
    openBatchDelete, closeBatchDelete, confirmBatchDelete,
    openHistory, closeHistory,
  };
}
