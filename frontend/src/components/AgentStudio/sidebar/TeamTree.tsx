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

  // 点击外部关闭菜单
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
    // 实时验证
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

  // 离开输入框时自动保存（显示警告弹窗）
  const handleTeamBlur = (teamId: string) => {
    setTimeout(() => {
      if (editingTeam === teamId) { // 确保还在编辑模式
        saveTeamName(teamId);
      }
    }, 100); // 延迟执行，确保点击事件优先处理
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
    // 实时验证
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

  // 离开输入框时自动保存（显示警告弹窗）
  const handleAgentBlur = () => {
    setTimeout(() => {
      if (editingAgent) { // 确保还在编辑模式
        saveAgentName();
      }
    }, 100); // 延迟执行，确保点击事件优先处理
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
      <div className="agentstudio-sidebar-section-header">
        <div className="agentstudio-sidebar-section-label">
          <Users size={14} /> {t('sidebar.myTeams')}
        </div>
        <button 
          className={`agentstudio-sidebar-section-action${!isAuthenticated ? ' action-locked' : ''}`}
          onClick={isAuthenticated ? handleAddTeam : () => openLoginModal()}
          title={isAuthenticated ? t('sidebar.createTeam') : '登录后解锁功能'}
        >
          {isAuthenticated ? <Plus size={14} /> : <Lock size={14} />}
        </button>
      </div>
      <div className="agentstudio-sidebar-menu">
        {teams.map((team) => (
          <div key={team.id} className="agentstudio-team-folder">
            <div className="agentstudio-team-folder-header" onClick={() => toggleTeam(team.id)}>
              <button
                className="agentstudio-team-toggle"
              >
                <ChevronDown 
                  size={14} 
                  className={`chevron-icon${team.isExpanded ? '' : ' collapsed'}`} 
                />
              </button>
              
              {team.isPinned && (
                <Pin size={12} className="agentstudio-team-pin" />
              )}
              
              {editingTeam === team.id ? (
                <div className="agentstudio-team-edit">
                  <input
                    className="agentstudio-team-edit-input"
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
                  <span className="agentstudio-team-name">{team.name}</span>
                  <span className="agentstudio-team-count">{team.agents.length}</span>
                  <button
                    className="agentstudio-team-menu-btn"
                    onClick={(e) => { e.stopPropagation(); toggleTeamMenu(team.id, e); }}
                    title={t('sidebar.moreOptions')}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {onTeamChat && (
                    <button
                      className="agentstudio-team-chat-btn"
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
                className="agentstudio-team-dropdown agentstudio-portal-dropdown"
                style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
              >
                <button
                  className="agentstudio-team-dropdown-item"
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
                  className="agentstudio-team-dropdown-item"
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
                  className="agentstudio-team-dropdown-item"
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
                  className="agentstudio-team-dropdown-item danger"
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
              <div className="agentstudio-team-agents">
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

      {/* 验证警告弹窗 */}
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
