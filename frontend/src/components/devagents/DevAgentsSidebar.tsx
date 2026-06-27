import { memo, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Users, Plus, ChevronDown, Sparkles, MessageSquare, MoreVertical, Pencil, Trash2, Pin, PinOff, Settings } from 'lucide-react';
import type { Team, Agent, Conversation } from '../../types/devagents';
import { useTranslation } from 'react-i18next';
import UserMenu from './sidebar/UserMenu';
import ConversationsList from './sidebar/ConversationsList';
import { validateName } from '../../utils/validation';
import { useChatStore } from '../../stores/chatStore';

interface DevAgentsSidebarProps {
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

const DevAgentsSidebar = memo(function DevAgentsSidebar({
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
}: DevAgentsSidebarProps) {
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
      setValidationWarning({ message: '名称不能为空' });
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
      setValidationWarning({ message: '名称不能为空' });
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
    <aside className={`devagents-sidebar ${isSidebarOpen ? 'open' : ' collapsed'}`}>
      <div className="devagents-sidebar-logo">
        <div className="devagents-header-logo">
          <Bot size={18} />
        </div>
        <span className="devagents-header-title">DevAgents OS</span>
      </div>

      <div className="devagents-sidebar-new-chat">
        <button className="devagents-sprint-btn" onClick={onNewChat}>
          <Sparkles size={16} />
          <span>{t('sidebar.newChat')}</span>
        </button>
      </div>

      <div className="devagents-sidebar-nav">
        <div>
          <div className="devagents-sidebar-section-header">
            <div className="devagents-sidebar-section-label">
              <Users size={14} /> {t('sidebar.myTeams')}
            </div>
            <button 
              className="devagents-sidebar-section-action" 
              onClick={handleAddTeam}
              title="创建团队"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="devagents-sidebar-menu">
            {teams.map((team) => (
              <div key={team.id} className="devagents-team-folder">
                <div className="devagents-team-folder-header" onClick={() => toggleTeam(team.id)}>
                  <button
                    className="devagents-team-toggle"
                  >
                    <ChevronDown 
                      size={14} 
                      className={`chevron-icon${team.isExpanded ? '' : ' collapsed'}`} 
                    />
                  </button>
                  
                  {team.isPinned && (
                    <Pin size={12} className="devagents-team-pin" />
                  )}
                  
                  {editingTeam === team.id ? (
                    <div className="devagents-team-edit">
                      <input
                        className="devagents-team-edit-input"
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
                      <span className="devagents-team-name">{team.name}</span>
                      <span className="devagents-team-count">{team.agents.length}</span>
                      <button
                        className="devagents-team-menu-btn"
                        onClick={(e) => { e.stopPropagation(); toggleTeamMenu(team.id, e); }}
                        title="更多选项"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </>
                  )}
                </div>

                {openTeamMenu === team.id && createPortal(
                  <div
                    className="devagents-team-dropdown devagents-portal-dropdown"
                    style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
                  >
                    <button
                      className="devagents-team-dropdown-item"
                      onClick={() => {
                        handleAddAgent(team.id);
                        setOpenTeamMenu(null);
                      }}
                    >
                      <Plus size={14} />
                      <span>{t('sidebar.addAgent')}</span>
                    </button>
                    <button
                      className="devagents-team-dropdown-item"
                      onClick={() => startEditTeam(team)}
                    >
                      <Pencil size={14} />
                      <span>重命名</span>
                    </button>
                    <button
                      className="devagents-team-dropdown-item"
                      onClick={() => {
                        handleTogglePinTeam(team.id);
                        setOpenTeamMenu(null);
                      }}
                    >
                      {team.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                      <span>{team.isPinned ? '取消置顶' : '置顶'}</span>
                    </button>
                    <button
                      className="devagents-team-dropdown-item danger"
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
                  <div className="devagents-team-agents">
                    {team.agents.map((agent) => (
                      <div
                        key={agent.id}
                        className={`devagents-team-agent-item-wrapper${selectedAgentId === agent.id ? ' active' : ''}`}
                      >
                        {editingAgent === agent.id ? (
                          <>
                          <div className="devagents-agent-edit">
                            <input
                              className="devagents-agent-edit-input"
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
                              className="devagents-team-agent-item"
                              onClick={() => {
                                handleAgentClick(agent);
                              }}
                            >
                              <span>{agent.name}</span>
                            </button>
                            <button
                              className="devagents-agent-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleAgentMenu(agent.id, e);
                              }}
                            >
                              <MoreVertical size={14} />
                            </button>

                            {openAgentMenu === agent.id && createPortal(
                              <div
                                className="devagents-agent-dropdown devagents-portal-dropdown"
                                style={{ position: 'fixed', top: menuPosition.top, left: menuPosition.left }}
                              >
                                <button
                                  className="devagents-agent-dropdown-item"
                                  onClick={() => {
                                    if (onEditAgent) {
                                      onEditAgent(agent);
                                    }
                                    setOpenAgentMenu(null);
                                  }}
                                >
                                  <Settings size={14} />
                                  <span>编辑</span>
                                </button>
                                <button
                                  className="devagents-agent-dropdown-item"
                                  onClick={() => startEditAgent(agent)}
                                >
                                  <Pencil size={14} />
                                  <span>重命名</span>
                                </button>
                                <button
                                  className="devagents-agent-dropdown-item danger"
                                  onClick={() => {
                                    setConfirmDelete({ type: 'agent', teamId: team.id, agentId: agent.id });
                                    setOpenAgentMenu(null);
                                  }}
                                >
                              <Trash2 size={14} />
                              <span>删除</span>
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
          <div className="devagents-sidebar-section-label">
            <MessageSquare size={14} /> 最近对话
          </div>
          <div className="devagents-sidebar-chats">
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
        <div className="devagents-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="devagents-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
            <div className="devagents-modal-header">
              <h3 id="confirm-delete-title">确认删除</h3>
              <button
                className="devagents-modal-close"
                onClick={() => setConfirmDelete(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="devagents-modal-content">
              <div className="devagents-confirm-body">
                <span className={`devagents-confirm-icon ${confirmDelete.type === 'team' ? 'danger' : 'warning'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <div className="devagents-confirm-text">
                  <p>
                    {confirmDelete.type === 'team'
                      ? '确定要删除该团队吗？团队内的所有 Agent 也将被删除，此操作不可撤销。'
                      : `确定要删除该 Agent 吗？此操作不可撤销。`}
                  </p>
                </div>
              </div>
            </div>
            <div className="devagents-modal-actions">
              <button
                className="devagents-modal-btn"
                onClick={() => setConfirmDelete(null)}
                autoFocus
              >
                取消
              </button>
              <button
                className="devagents-modal-btn danger"
                onClick={confirmDeleteAction}
              >
                删除
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* 验证警告弹窗 */}
      {validationWarning && createPortal(
        <div className="devagents-modal-overlay" onClick={() => setValidationWarning(null)}>
          <div className="devagents-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="devagents-modal-header">
              <h3>提示</h3>
              <button
                className="devagents-modal-close"
                onClick={() => setValidationWarning(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="devagents-modal-content">
              <div className="devagents-confirm-body">
                <span className="devagents-confirm-icon warning">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <div className="devagents-confirm-text">
                  <p>{validationWarning.message}</p>
                </div>
              </div>
            </div>
            <div className="devagents-modal-actions">
              <button
                className="devagents-modal-btn danger"
                onClick={() => setValidationWarning(null)}
                autoFocus
              >
                确定
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </aside>
  );
});

export default DevAgentsSidebar;
