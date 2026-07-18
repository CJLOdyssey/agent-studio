import { memo, useCallback } from 'react';
import { Bot, Sparkles, MessageSquare } from 'lucide-react';
import type { Team, Agent, Conversation } from '../../types/AgentStudio';
import { useTranslation } from 'react-i18next';
import UserMenu from './sidebar/UserMenu';
import ConversationsList from './sidebar/ConversationsList';
import TeamTree from './sidebar/TeamTree';
import { useChatStore } from '../../stores/chatStore';
import { useAuth } from '../auth';

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
  onEditAgent?: (agent: Agent) => void;
  onTeamChat?: (teamId: string) => void;
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
  onTeamChat,
  isSidebarOpen,
  onOpenWorkstation,
}: AgentStudioSidebarProps) {
  const { t } = useTranslation();
  const { isAuthenticated, openLoginModal } = useAuth();

  const handleConvSelect = useCallback(
    (conv: Conversation) => {
      setSelectedAgentId(null);
      setActiveConvId(conv.id);
      setInputValue(conv.title);
      if (conv.teamId) {
        useChatStore.getState().setActiveTeam(conv.teamId);
      }
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
        <TeamTree
          teams={teams}
          selectedAgentId={selectedAgentId}
          isAuthenticated={isAuthenticated}
          openLoginModal={openLoginModal}
          toggleTeam={toggleTeam}
          handleAddTeam={handleAddTeam}
          handleAddAgent={handleAddAgent}
          handleDeleteTeam={handleDeleteTeam}
          handleDeleteAgent={handleDeleteAgent}
          handleRenameTeam={handleRenameTeam}
          handleRenameAgent={handleRenameAgent}
          handleTogglePinTeam={handleTogglePinTeam}
          handleAgentClick={handleAgentClick}
          onEditAgent={onEditAgent}
          onTeamChat={onTeamChat}
        />

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
    </aside>
  );
});

export default AgentStudioSidebar;
