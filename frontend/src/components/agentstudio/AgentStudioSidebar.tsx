import { memo, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Users, Plus, ChevronDown, Sparkles, MessageSquare, MoreVertical, Pencil, Trash2, Pin, PinOff, Settings } from 'lucide-react';
import type { Team, Agent, Conversation } from '../../types/agentstudio';
import { useTranslation } from 'react-i18next';
import UserMenu from './sidebar/UserMenu';
import ConversationsList from './sidebar/ConversationsList';
import { validateName } from '../../utils/validation';
import { useChatStore } from '../../stores/chatStore';

interface AgentStudioSidebarProps {
  teams: Team[];
  selectedAgentId: string | null;
  conversations: Conversation[];
  activeConvId: string | null;
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsApiOpen: (open: boolean) => void;
  setSelectedAgentId: (id: string | null) => void;
  setActiveConvId: (id: string | null) => void;
  setInputValue: (value: string) => void;
  setConversations: (fn: (prev: Conversation[]) => Conversation[]) => void;
  onNewChat: () => void;
  toggleTeam: (teamId: string) => void;
  handleAddTeam: () => void;
  handleAddAgent: (teamId: string) => void;
  handleDeleteTeam: (teamId: string) => void;
  handleDeleteAgent: (teamId: string, agentId: string) => void;
  handleRenameTeam: (teamId: string, name: string) => void;
  handleRenameAgent: (agentId: string, name: string) => void;
  handleTogglePinTeam: (teamId: string) => void;
  handleAgentClick: (agent: Agent) => void;
  onEditAgent?: (agent: Agent) => void; // 新增：编辑Agent配置
  isSidebarOpen: boolean;
  onOpenWorkstation: () => void;
}

const AgentStudioSidebar = memo(function AgentStudioSidebar({
  teams,
  selectedAgentId,
  conversations,
  activeConvId,
  isUserMenuOpen,
  setIsUserMenuOpen,
  setIsSettingsOpen,
  setIsApiOpen,
  setSelectedAgentId,
  setActiveConvId,
  setInputValue,
  setConversations,
  onNewChat,
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
  isSidebarOpen,
  onOpenWorkstation,
}: AgentStudioSidebarProps) {
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

  const handleConvSelect = useCallback(
    (conv: Conversation) => {
      setSelectedAgentId(null);
      setActiveConvId(conv.id);
      setInputValue(conv.title);
    },
    [setSelectedAgentId, setActiveConvId, setInputValue],
  );

  const handleConvDelete = useCallback(
    (convId: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        useChatStore.getState().reset();
      }
    },
    [activeConvId, setConversations, setActiveConvId],
  );


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
    <aside className={`agentstudio-sidebar ${isSidebarOpen ? 'open' : ' collapsed'}`}>
      <div className="agentstudio-sidebar-logo">
        <div className="agentstudio-header-logo">
          <Bot size={18} />
        </div>
        <span className="agentstudio-header-title">AgentStudio</span>
      </div>

      <div className="agentstudio-sidebar-new-chat">
        <button className="agentstudio-sprint-btn" onClick={onNewChat}>
          <Sparkles size={16} />
          <span>{t('sidebar.newChat')}</span>
        </button>
      </div>

      <div className="agentstudio-sidebar-nav">
        <div>
          <div className="agentstudio-sidebar-section-header">
            <div className="agentstudio-sidebar-section-label">
              <Users size={14} /> {t('sidebar.myTeams')}
            </div>
            <button 
              className="agentstudio-sidebar-section-action" 
              onClick={handleAddTeam}
              title={t('sidebar.createTeam')}
            >
              <Plus size={14} />
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
                        handleAddAgent(team.id);
                        setOpenTeamMenu(null);
                      }}
                    >
                      <Plus size={14} />
                      <span>{t('sidebar.addAgent')}</span>
                    </button>
                    <button
                      className="agentstudio-team-dropdown-item"
                      onClick={() => startEditTeam(team)}
                    >
                      <Pencil size={14} />
                      <span>重命名</span>
                    </button>
                    <button
                      className="agentstudio-team-dropdown-item"
                      onClick={() => {
                        handleTogglePinTeam(team.id);
                        setOpenTeamMenu(null);
                      }}
                    >
                      {team.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                      <span>{team.isPinned ? t('sidebar.unpin') : t('sidebar.pin')}</span>
                    </button>
                    <button
                      className="agentstudio-team-dropdown-item danger"
                      onClick={() => {
                        setConfirmDelete({ type: 'team', teamId: team.id });
                        setOpenTeamMenu(null);
                      }}
                    >
                      <Trash2 size={14} />
                      <span>删除</span>
                    </button>
                  </div>,
                  document.body,
                )}
                
                {team.isExpanded && (
                  <div className="agentstudio-team-agents">
                    {team.agents.map((agent) => (
                      <div
                        key={agent.id}
                        className={`agentstudio-team-agent-item-wrapper${selectedAgentId === agent.id ? ' active' : ''}`}
                      >
                        {editingAgent === agent.id ? (
                          <>
                          <div className="agentstudio-agent-edit">
                            <input
                              className="agentstudio-agent-edit-input"
                              value={editAgentName}
                              onChange={(e) => onAgentNameChange(e.target.value)}
                              onBlur={handleAgentBlur}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAgentName();
                              }}
                              autoFocus
                            />
                          </div>
                          </>
                        ) : (
                          <>
                            <button
                              className="agentstudio-team-agent-item"
                              onClick={() => {
                                handleAgentClick(agent);
                              }}
                            >
                              <span>{agent.name}</span>
                            </button>
                            <button
                              className="agentstudio-agent-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAgentMenu(agent.id, e);
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openAgentMenu === agent.id && createPortal(
                              <div
                                className="agentstudio-agent-dropdown agentstudio-portal-dropdown"
                                style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
                              >
                                <button
                                  className="agentstudio-agent-dropdown-item"
                                  onClick={() => {
                                    if (onEditAgent) {
                                      onEditAgent(agent);
                                    }
                                    setOpenAgentMenu(null);
                                  }}
                                >
                                  <Settings size={14} />
                                  <span>{t('sidebar.edit')}</span>
                                </button>
                                <button
                                  className="agentstudio-agent-dropdown-item"
                                  onClick={() => startEditAgent(agent)}
                                >
                                  <Pencil size={14} />
                      <span>{t('sidebar.rename')}</span>
                                </button>
                                <button
                                  className="agentstudio-agent-dropdown-item danger"
                                  onClick={() => {
                                    setConfirmDelete({ type: 'agent', teamId: team.id, agentId: agent.id });
                                    setOpenAgentMenu(null);
                                  }}
                                >
                              <Trash2 size={14} />
                  <span>{t('sidebar.delete')}</span>
                            </button>
                          </div>,
                          document.body,
                        )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="agentstudio-sidebar-section-label">
            <MessageSquare size={14} /> {t('sidebar.recentConversations')}
          </div>
          <div className="agentstudio-sidebar-chats">
            <ConversationsList
              conversations={conversations}
              activeConvId={activeConvId}
              selectedAgentId={selectedAgentId}
              agents={teams.flatMap((t) => t.agents)}
              onSelect={handleConvSelect}
              onDelete={handleConvDelete}
            />
          </div>
        </div>
      </div>

      <UserMenu
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsApiOpen={setIsApiOpen}
        onOpenWorkstation={onOpenWorkstation}
      />

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
    </aside>
  );
});

export default AgentStudioSidebar;
