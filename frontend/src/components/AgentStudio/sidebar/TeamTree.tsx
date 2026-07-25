import { memo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, Plus, ChevronDown, MoreVertical, Pencil, Trash2, Pin, PinOff, Lock } from 'lucide-react';
import type { Team, Agent } from '../../../types/AgentStudio';
import { useTranslation } from 'react-i18next';
import { validateName } from '../../../utils/validation';
import TeamTreeAgentItem from './TeamTreeAgentItem';

interface TeamTreeProps {
  teams: Team[];
  selectedAgentId: string | null;
  isAuthenticated: boolean;
  openLoginModal: () => void;
  toggleTeam: (teamId: string) => void;
  handleAddTeam: () => void;
  handleAddAgent: (teamId: string) => void;
  handleDeleteTeam: (teamId: string) => void;
  handleDeleteAgent: (teamId: string, agentId: string) => void;
  handleRenameTeam: (teamId: string, name: string) => void;
  handleRenameAgent: (agentId: string, name: string) => void;
  handleTogglePinTeam: (teamId: string) => void;
  handleAgentClick: (agent: Agent) => void;
  onEditAgent?: (agent: Agent) => void;
  onTeamChat?: (teamId: string) => void;
}

const TeamTree = memo(function TeamTree({
  teams,
  selectedAgentId,
  isAuthenticated,
  openLoginModal,
  toggleTeam,
  handleAddTeam,
  handleAddAgent,
  handleDeleteTeam,
  handleDeleteAgent,
  handleRenameTeam,
  handleRenameAgent,
  handleTogglePinTeam,
  handleAgentClick,
  onEditAgent,
  onTeamChat,
}: TeamTreeProps) {
  const { t } = useTranslation();
  const [openTeamMenu, setOpenTeamMenu] = useState<string | null>(null);
  const [openAgentMenu, setOpenAgentMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'team' | 'agent'; teamId: string; agentId?: string } | null>(null);
  const [validationWarning, setValidationWarning] = useState<{ message: string; onConfirm?: () => void } | null>(null);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editAgentName, setEditAgentName] = useState('');

  useEffect(() => {
    if (!openTeamMenu && !openAgentMenu) return;
    const handleClickOutside = () => {
      setOpenTeamMenu(null);
      setOpenAgentMenu(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openTeamMenu, openAgentMenu]);

  const startEditTeam = (team: Team) => {
    setEditingTeam(team.id);
    setEditName(team.name);
    setOpenTeamMenu(null);
  };

  const saveTeamName = (teamId: string) => {
    const name = editName.trim();
    if (!name) {
      setValidationWarning({ message: t('sidebar.nameNotEmpty') });
      return;
    }
    const existingNames = teams.filter((t) => t.id !== teamId).map((t) => t.name);
    const validation = validateName(name, existingNames);
    if (!validation.valid) {
      setValidationWarning({ message: validation.error! });
      return;
    }
    handleRenameTeam(teamId, name);
    setEditingTeam(null);
    setEditName('');
  };

  const handleTeamBlur = (teamId: string) => {
    setTimeout(() => {
      if (editingTeam === teamId) {
        saveTeamName(teamId);
      }
    }, 100);
  };

  const onTeamNameChange = (value: string) => {
    setEditName(value);
  };

  const startEditAgent = (agent: Agent) => {
    setEditingAgent(agent.id);
    setEditAgentName(agent.name);
    setOpenAgentMenu(null);
  };

  const saveAgentName = () => {
    const name = editAgentName.trim();
    if (!name) {
      setValidationWarning({ message: t('sidebar.nameNotEmpty') });
      return;
    }
    if (!editingAgent) return;
    let existingNames: string[] = [];
    teams.forEach((team) => {
      if (team.agents.some((a) => a.id === editingAgent)) {
        existingNames = team.agents.filter((a) => a.id !== editingAgent).map((a) => a.name);
      }
    });
    const validation = validateName(name, existingNames);
    if (!validation.valid) {
      setValidationWarning({ message: validation.error! });
      return;
    }
    handleRenameAgent(editingAgent, name);
    setEditingAgent(null);
    setEditAgentName('');
  };

  const handleAgentBlur = () => {
    setTimeout(() => {
      if (editingAgent) {
        saveAgentName();
      }
    }, 100);
  };

  const onAgentNameChange = (value: string) => {
    setEditAgentName(value);
  };

  const confirmDeleteAction = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'team') {
      handleDeleteTeam(confirmDelete.teamId);
    } else if (confirmDelete.agentId) {
      handleDeleteAgent(confirmDelete.teamId, confirmDelete.agentId);
    }
    setConfirmDelete(null);
  };

  const toggleTeamMenu = (teamId: string, event: React.MouseEvent) => {
    if (openTeamMenu === teamId) {
      setOpenTeamMenu(null);
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.right - 140 });
      setOpenTeamMenu(teamId);
      setOpenAgentMenu(null);
    }
  };

  const toggleAgentMenu = (agentId: string, event: React.MouseEvent) => {
    if (openAgentMenu === agentId) {
      setOpenAgentMenu(null);
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setMenuPosition({ top: rect.bottom + 4, left: rect.right - 140 });
      setOpenAgentMenu(agentId);
      setOpenTeamMenu(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between pr-1 pb-[6px] min-h-[28px]">
        <div className="flex items-center gap-[6px] text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.5px]">
          <Users size={14} /> {t('sidebar.myTeams')}
        </div>
        <button
          className={`bg-transparent border-none p-1 rounded cursor-pointer text-[var(--color-text-tertiary)] flex items-center justify-center transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] hover:opacity-100${!isAuthenticated ? ' opacity-35' : ' opacity-50'}`}
          onClick={isAuthenticated ? handleAddTeam : () => openLoginModal()}
          title={isAuthenticated ? t('sidebar.createTeam') : '登录后解锁功能'}
        >
          {isAuthenticated ? <Plus size={14} /> : <Lock size={14} />}
        </button>
      </div>
      <div className="p-0 flex flex-col gap-0.5">
        {teams.map((team) => (
          <div key={team.id} className="mb-px rounded-md overflow-visible">
            <div className="group flex items-center gap-[6px] py-[6px] pl-[6px] pr-[32px] cursor-pointer transition-colors duration-150 bg-transparent relative min-h-[32px] rounded-md hover:bg-[var(--color-surface-hover)]" onClick={() => toggleTeam(team.id)}>
              <button
                className="bg-transparent border-none p-[2px] rounded cursor-pointer text-[var(--color-text-muted)] flex items-center justify-center transition-all duration-200 flex-shrink-0 w-[18px] h-[18px] opacity-60 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:opacity-100"
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${team.isExpanded ? '' : '-rotate-90'}`}
                />
              </button>

              {team.isPinned && (
                <Pin size={12} className="text-[var(--color-accent-soft)] flex-shrink-0 mr-[-2px]" />
              )}

              {editingTeam === team.id ? (
                <div className="flex-1 min-w-0">
                  <input
                    className="w-full py-[3px] px-[6px] border border-[var(--color-accent)] rounded text-sm font-medium text-[var(--color-text-primary)] bg-transparent outline-none font-[inherit]"
                    value={editName}
                    onChange={(e) => onTeamNameChange(e.target.value)}
                    onBlur={() => handleTeamBlur(team.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTeamName(team.id);
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0 leading-[1] tracking-[-0.01em]">{team.name}</span>
                  <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 font-normal opacity-50 min-w-[12px] text-right">{team.agents.length}</span>
                  <button
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-transparent border-none p-[3px] rounded cursor-pointer text-[var(--color-text-muted)] opacity-0 transition-all duration-150 z-10 flex items-center justify-center w-[22px] h-[22px] group-hover:opacity-60 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); toggleTeamMenu(team.id, e); }}
                    title={t('sidebar.moreOptions')}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {onTeamChat && (
                    <button
                      className="absolute right-[30px] top-1/2 -translate-y-1/2 bg-transparent border-none p-[3px] rounded cursor-pointer text-[var(--color-text-muted)] opacity-0 transition-all duration-150 flex items-center justify-center w-[22px] h-[22px] group-hover:opacity-60 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)] hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); onTeamChat(team.id); }}
                      title="团队对话"
                    >
                      <Users size={14} />
                    </button>
                  )}
                </>
              )}
            </div>

            {openTeamMenu === team.id && createPortal(
              <div
                className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-1 min-w-[140px] shadow-[0_4px_16px_rgba(0,0,0,0.15)] z-[99999]"
                style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
              >
                <button
                  className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                  onClick={() => {
                    if (!isAuthenticated) { openLoginModal(); return; }
                    handleAddAgent(team.id);
                    setOpenTeamMenu(null);
                  }}
                  title={!isAuthenticated ? '登录后解锁功能' : undefined}
                >
                  {isAuthenticated ? <Plus size={14} /> : <Lock size={14} />}
                  <span>{t('sidebar.addAgent')}</span>
                </button>
                <button
                  className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                  onClick={() => {
                    if (!isAuthenticated) { openLoginModal(); return; }
                    startEditTeam(team);
                  }}
                  title={!isAuthenticated ? '登录后解锁功能' : undefined}
                >
                  {isAuthenticated ? <Pencil size={14} /> : <Lock size={14} />}
                  <span>{t('workstation.rename')}</span>
                </button>
                <button
                  className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--color-text-secondary)] text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                  onClick={() => {
                    if (!isAuthenticated) { openLoginModal(); return; }
                    handleTogglePinTeam(team.id);
                    setOpenTeamMenu(null);
                  }}
                  title={!isAuthenticated ? '登录后解锁功能' : undefined}
                >
                  {isAuthenticated ? (team.isPinned ? <PinOff size={14} /> : <Pin size={14} />) : <Lock size={14} />}
                  <span>{team.isPinned ? t('sidebar.unpin') : t('sidebar.pin')}</span>
                </button>
                <button
                  className="flex items-center gap-2 py-[7px] px-[10px] rounded-md cursor-pointer transition-colors duration-150 border-none bg-transparent w-full text-sm text-[var(--da-accent-red)] text-left hover:bg-[color-mix(in_srgb,var(--da-accent-red)_10%,transparent)]"
                  onClick={() => {
                    if (!isAuthenticated) { openLoginModal(); return; }
                    setConfirmDelete({ type: 'team', teamId: team.id });
                    setOpenTeamMenu(null);
                  }}
                  title={!isAuthenticated ? '登录后解锁功能' : undefined}
                >
                  {isAuthenticated ? <Trash2 size={14} /> : <Lock size={14} />}
                  <span>{t('workstation.delete')}</span>
                </button>
              </div>,
              document.body,
            )}

            {team.isExpanded && (
              <div className="py-px ml-[28px]">
                {team.agents.map((agent) => (
                  <TeamTreeAgentItem
                    key={agent.id}
                    agent={agent}
                    teamId={team.id}
                    selectedAgentId={selectedAgentId}
                    isAuthenticated={isAuthenticated}
                    openLoginModal={openLoginModal}
                    editingAgent={editingAgent}
                    editAgentName={editAgentName}
                    openAgentMenu={openAgentMenu}
                    menuPosition={menuPosition}
                    handleAgentClick={handleAgentClick}
                    onEditAgent={onEditAgent}
                    setOpenAgentMenu={setOpenAgentMenu}
                    setConfirmDelete={setConfirmDelete}
                    toggleAgentMenu={toggleAgentMenu}
                    startEditAgent={startEditAgent}
                    saveAgentName={saveAgentName}
                    handleAgentBlur={handleAgentBlur}
                    onAgentNameChange={onAgentNameChange}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {confirmDelete && createPortal(
        <div className="agentstudio-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="agentstudio-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <div className="agentstudio-modal-header">
              <h3 id="confirm-delete-title">{t('confirm.title')}</h3>
              <button
                className="agentstudio-modal-close"
                onClick={() => setConfirmDelete(null)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="agentstudio-modal-content">
              <div className="agentstudio-confirm-body">
                <span className={`agentstudio-confirm-icon ${confirmDelete.type === 'team' ? 'danger' : 'warning'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <div className="agentstudio-confirm-text">
                  <p>
                    {confirmDelete.type === 'team'
                      ? t('confirm.deleteTeamConfirm')
                      : t('confirm.deleteAgentConfirm')}
                  </p>
                </div>
              </div>
            </div>
            <div className="agentstudio-modal-actions">
              <button
                className="agentstudio-modal-btn"
                onClick={() => setConfirmDelete(null)}
                autoFocus
              >
                {t('common.cancel')}
              </button>
              <button
                className="agentstudio-modal-btn danger"
                onClick={confirmDeleteAction}
              >
                {t('sidebar.delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {validationWarning && createPortal(
        <div className="agentstudio-modal-overlay" onClick={() => setValidationWarning(null)}>
          <div className="agentstudio-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="agentstudio-modal-header">
              <h3>{t('confirm.tip')}</h3>
              <button
                className="agentstudio-modal-close"
                onClick={() => setValidationWarning(null)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="agentstudio-modal-content">
              <div className="agentstudio-confirm-body">
                <span className="agentstudio-confirm-icon warning">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <div className="agentstudio-confirm-text">
                  <p>{validationWarning.message}</p>
                </div>
              </div>
            </div>
            <div className="agentstudio-modal-actions">
              <button
                className="agentstudio-modal-btn danger"
                onClick={() => setValidationWarning(null)}
                autoFocus
              >
                {t('confirm.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
});

export default TeamTree;
