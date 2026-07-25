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
    <aside className={`flex flex-col h-full w-[var(--da-sidebar-width)] min-w-[var(--da-sidebar-width)] bg-[var(--color-surface-sidebar)] border-r border-r-[var(--color-border-subtle)] shrink-0 overflow-hidden transition-[width,min-width,opacity] duration-200 ${isSidebarOpen ? '' : 'w-0 min-w-0 opacity-0 pointer-events-none'}`}>
      <div className="flex items-center gap-[10px] p-3 shrink-0">
        <div className="w-8 h-8 bg-[color-mix(in_srgb,var(--color-surface),var(--color-text-primary)_8%)] rounded-lg flex items-center justify-center text-[var(--color-accent)] shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
          <Bot size={18} />
        </div>
        <span className="font-semibold text-[var(--da-font-size-base)] text-[var(--color-text-primary)] tracking-[-0.02em]">AgentStudio</span>
      </div>

      <div className="px-3 pb-3 shrink-0">
        <button className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-transparent border-none rounded-lg text-[var(--color-text-primary)] text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)]" onClick={onNewChat}>
          <Sparkles size={16} />
          <span>{t('sidebar.newChat')}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-4">
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
          <div className="flex items-center gap-[6px] text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-[0.5px]">
            <MessageSquare size={14} /> {t('sidebar.recentConversations')}
          </div>
          <div className="p-0">
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
