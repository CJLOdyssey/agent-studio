import React, { memo, useCallback } from 'react';
import { Bot, Users, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import type { Team, Agent, Conversation } from '../../types/devagents';
import { useTranslation } from 'react-i18next';
import UserMenu from './sidebar/UserMenu';
import ConversationsList from './sidebar/ConversationsList';

interface DevAgentsSidebarProps {
  teams: Team[];
  selectedAgentId: string | null;
  editingTeamId: string | null;
  editTeamName: string;
  setEditTeamName: (name: string) => void;
  conversations: Conversation[];
  activeConvId: number | null;
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsApiOpen: (open: boolean) => void;
  setSelectedAgentId: (id: string | null) => void;
  setActiveConvId: (id: number | null) => void;
  setInputValue: (value: string) => void;
  setConversationKey: (fn: (prev: number) => number) => void;
  setConversations: (fn: (prev: Conversation[]) => Conversation[]) => void;
  onNewChat: () => void;
  toggleTeam: (teamId: string) => void;
  handleAddTeam: () => void;
  handleAddAgent: (e: React.MouseEvent, teamId: string) => void;
  startEditTeam: (e: React.MouseEvent, team: Team) => void;
  saveTeamName: (teamId: string) => void;
  handleTeamNameKeyDown: (e: React.KeyboardEvent, teamId: string) => void;
  handleDeleteTeam: (e: React.MouseEvent, teamId: string) => void;
  handleDeleteAgent: (e: React.MouseEvent, teamId: string, agentId: string) => void;
  handleAgentClick: (agent: Agent) => void;
  handleOpenAgentConfig: (e: React.MouseEvent, agent: Agent) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const DevAgentsSidebar = memo(function DevAgentsSidebar({
  teams,
  selectedAgentId,
  editingTeamId,
  editTeamName,
  setEditTeamName,
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
  startEditTeam,
  saveTeamName,
  handleTeamNameKeyDown,
  handleDeleteTeam,
  handleDeleteAgent,
  handleAgentClick,
  handleOpenAgentConfig,
  isSidebarOpen,
  setIsSidebarOpen,
}: DevAgentsSidebarProps) {
  const { t } = useTranslation();

  const handleConvSelect = useCallback(
    (conv: Conversation) => {
      setSelectedAgentId(null);
      setActiveConvId(conv.id);
      setInputValue('');
    },
    [setSelectedAgentId, setActiveConvId, setInputValue],
  );

  const handleConvDelete = useCallback(
    (convId: number) => {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
      }
    },
    [activeConvId, setConversations, setActiveConvId],
  );

  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), [setIsSidebarOpen]);

  return (
    <aside className={`devagents-sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <div className="devagents-sidebar-header">
        <div className="devagents-logo" onClick={() => setSelectedAgentId(null)} style={{ cursor: 'pointer' }}>
          <div className="devagents-logo-icon">
            <Bot size={18} />
          </div>
          <div>
            <h1>DevAgents OS</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>
        <button className="devagents-sidebar-close" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="devagents-sidebar-content">
        <button className="devagents-sprint-btn" onClick={onNewChat}>
          <Sparkles size={16} />
          <span>{t('sidebar.newChat')}</span>
        </button>

        <div className="devagents-section-header">
          <div className="devagents-section-title">
            <Users size={14} />
            {t('sidebar.myTeams')}
          </div>
          <button
            className="devagents-icon-btn"
            onClick={handleAddTeam}
            title={t('sidebar.newTeam')}
            aria-label={t('sidebar.newTeam')}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="devagents-teams-list">
          {teams.map((team) => (
            <div key={team.id} className="devagents-team">
              <div
                className="devagents-team-header"
                role="button"
                tabIndex={0}
                aria-expanded={team.isExpanded}
                aria-label={team.name}
                onClick={() => {
                  if (editingTeamId === team.id) return;
                  if (editingTeamId) {
                    saveTeamName(editingTeamId);
                  }
                  toggleTeam(team.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (editingTeamId === team.id) return;
                    if (editingTeamId) saveTeamName(editingTeamId);
                    toggleTeam(team.id);
                  }
                }}
              >
                <div className="devagents-team-title">
                  {team.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}

                  {editingTeamId === team.id ? (
                    <input
                      type="text"
                      value={editTeamName}
                      aria-label={editTeamName || 'Team name'}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      onBlur={() => saveTeamName(team.id)}
                      onKeyDown={(e) => handleTeamNameKeyDown(e, team.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="devagents-team-input"
                    />
                  ) : (
                    <>
                      <span className="devagents-team-name">{team.name}</span>
                      <span className="devagents-team-count">{team.agents.length}</span>
                    </>
                  )}
                </div>

                {editingTeamId !== team.id && (
                  <div className="devagents-team-actions">
                    <button
                      onClick={(e) => startEditTeam(e, team)}
                      className="devagents-icon-btn-sm"
                      title={t('sidebar.renameTeam')}
                      aria-label={t('sidebar.renameTeam')}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => handleAddAgent(e, team.id)}
                      className="devagents-icon-btn-sm"
                      title={t('sidebar.addAgent')}
                      aria-label={t('sidebar.addAgent')}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTeam(e, team.id)}
                      className="devagents-icon-btn-sm"
                      title={t('sidebar.deleteTeam')}
                      aria-label={t('sidebar.deleteTeam')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {team.isExpanded && (
                <ul className="devagents-agents-list">
                  {team.agents.map((agent) => (
                    <li
                      key={agent.id}
                      className={`devagents-agent-item ${selectedAgentId === agent.id ? 'selected' : ''}`}
                      onClick={() => {
                        handleAgentClick(agent);
                        setIsSidebarOpen(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleAgentClick(agent);
                          setIsSidebarOpen(false);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-selected={selectedAgentId === agent.id}
                    >
                      <div className="devagents-agent-info">
                        <div className="devagents-agent-header">
                          <span className="devagents-agent-name">{agent.name}</span>
                        </div>
                      </div>

                      <div className="devagents-agent-actions">
                        <button
                          onClick={(e) => handleOpenAgentConfig(e, agent)}
                          className="devagents-icon-btn-sm"
                          title={t('sidebar.configAgent')}
                          aria-label={t('sidebar.configAgent')}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteAgent(e, team.id, agent.id)}
                          className="devagents-icon-btn-sm"
                          title={t('sidebar.deleteAgent')}
                          aria-label={t('sidebar.deleteAgent')}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </li>
                  ))}
                  {team.agents.length === 0 && <li className="devagents-empty-team">{t('sidebar.noAgents')}</li>}
                </ul>
              )}
            </div>
          ))}
        </div>

        <ConversationsList
          conversations={conversations}
          activeConvId={activeConvId}
          selectedAgentId={selectedAgentId}
          onSelect={handleConvSelect}
          onDelete={handleConvDelete}
          onCloseSidebar={handleCloseSidebar}
        />
      </div>

      <UserMenu
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsApiOpen={setIsApiOpen}
      />
    </aside>
  );
});

export default DevAgentsSidebar;
