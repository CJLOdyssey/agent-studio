import { memo, useCallback } from 'react';
import { Bot, Sparkles, MessageSquare, PanelLeft } from 'lucide-react';
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
  onToggleSidebar: () => void;
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
  onToggleSidebar,
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
    <aside className={`flex flex-col h-full bg-[var(--color-surface-sidebar)] border-r border-r-[var(--color-border-subtle)] shrink-0 overflow-hidden transition-[width,min-width,opacity,border-width] duration-200 ease-in-out ${isSidebarOpen ? 'w-[var(--da-sidebar-width)] min-w-[var(--da-sidebar-width)] opacity-100' : 'w-0 min-w-0 opacity-0 pointer-events-none border-r-0'}`}>
      {/* Header: logo + toggle */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center text-[var(--color-accent)] shrink-0">
            <Bot size={20} />
          </div>
          <span className="font-semibold text-base text-[var(--color-text-primary)] tracking-[-0.02em] truncate">AgentStudio</span>
        </div>
        <button
          className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-lg text-[var(--color-text-muted)] cursor-pointer transition-[color,background] duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] shrink-0"
          onClick={onToggleSidebar}
          aria-label="Collapse sidebar"
        >
          <PanelLeft size={18} />
        </button>
      </div>

      {/* New Chat - primary action */}
      <div className="px-4 pb-3 shrink-0">
        <button className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-surface-elevated)] hover:border-[var(--color-accent)]/40 active:scale-[0.98]" onClick={onNewChat}>
          <Sparkles size={14} className="text-[var(--color-accent)]" />
          <span>{t('sidebar.newChat')}</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-3 flex flex-col gap-4">
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
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-tertiary)] tracking-[0.04em] mb-1.5">
            <MessageSquare size={13} /> {t('sidebar.recentConversations')}
          </div>
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

      {/* User menu - bottom pinned */}
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
