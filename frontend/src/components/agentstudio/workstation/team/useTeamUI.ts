import { useState, useCallback, useEffect } from 'react';
import type { TeamEntry, TeamFormData } from './team.types';
import type { useTeamData } from './useTeamData';

type TeamData = ReturnType<typeof useTeamData>;

export function useTeamUI() {
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamEntry | null>(null);
  const [formData, setFormDataRaw] = useState<TeamFormData>({ name: '', description: '', status: 'active' });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<TeamEntry | null>(null);
  const [isBatchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<TeamEntry | null>(null);
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

  const setFormData = useCallback((fn: (f: TeamFormData) => TeamFormData) => setFormDataRaw(fn), []);
  const closeMenu = useCallback(() => { setOpenMenuId(null); setMenuAnchorEl(null); }, []);

  function openCreate() {
    setEditingItem(null); setFormDataRaw({ name: '', description: '', status: 'active' }); setFormErrors([]); setFormOpen(true);
  }
  function openEdit(item: TeamEntry) {
    setEditingItem(item); setFormDataRaw({ name: item.name, description: item.description, status: item.status }); setFormErrors([]); setFormOpen(true);
  }
  function openDelete(item: TeamEntry) { setDeletingItem(item); setDeleteOpen(true); }
  function openBatchDelete() { setBatchDeleteOpen(true); }
  function openHistory(item: TeamEntry) { setHistoryItem(item); setHistoryOpen(true); }
  function closeDelete() { setDeleteOpen(false); setDeletingItem(null); }
  function closeBatchDelete() { setBatchDeleteOpen(false); }
  function closeHistory() { setHistoryOpen(false); setHistoryItem(null); }
  function closeForm() { setFormOpen(false); setEditingItem(null); setFormErrors([]); }
  function validate() { const errs: string[] = []; if (!formData.name.trim()) errs.push('团队名称不能为空'); else if (formData.name.length < 2 || formData.name.length > 50) errs.push('团队名称长度需在 2-50 个字符之间'); setFormErrors(errs); return errs.length === 0; }
  function save(data: TeamData) { if (!validate()) return; if (editingItem) data.updateTeam(editingItem.id, formData); else data.addTeam(formData); closeForm(); }
  function confirmDelete(data: TeamData) { if (!deletingItem) return; data.deleteTeam(deletingItem.id); closeDelete(); }
  function confirmBatchDelete(data: TeamData) { data.batchDelete(data.selectedIds); closeBatchDelete(); }

  return {
    isFormOpen, editingItem, formData, setFormData, formErrors, setFormErrors,
    isDeleteOpen, setDeleteOpen, deletingItem, setDeletingItem,
    isBatchDeleteOpen, setBatchDeleteOpen,
    isHistoryOpen, setHistoryOpen, historyItem, setHistoryItem,
    openMenuId, setOpenMenuId, menuAnchorEl, setMenuAnchorEl,
    closeMenu,
    openCreate, openEdit, openDelete, openBatchDelete, openHistory,
    closeDelete, closeBatchDelete, closeHistory,
    closeForm, validate, save, confirmDelete, confirmBatchDelete,
  };
}
