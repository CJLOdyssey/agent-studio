import { PanelLeft, Sun, Moon, Bell } from 'lucide-react';
import AgentStudioSidebar from './AgentStudioSidebar';
import Workspace from './workspace/Workspace';
import { InputToolbar } from '../input';
import { useChatStore } from '../../stores/chatStore';
import HomeScreen from './HomeScreen';
import MessagesPanel from './MessagesPanel';
import Modals from './Modals';
import WorkstationPage from './WorkstationPage';
import { useRef } from 'react';
import { useWorkstationState } from './useWorkstationState';
import type { InputToolbarHandle } from '../input';

export default function AgentStudioWorkstation() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const inputToolbarRef = useRef<InputToolbarHandle>(null);
  const s = useWorkstationState(messagesContainerRef, workspaceRef, inputToolbarRef);

  return (
    <>
      {s.isWorkstationOpen ? (
        <WorkstationPage />
      ) : (
          <div className="h-screen w-full flex flex-col overflow-hidden bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
            <div className="flex flex-1 overflow-hidden relative">

            <AgentStudioSidebar
              teams={s.teamMgmt.teams}
              selectedAgentId={s.selectedAgentId}
              conversations={s.filteredConversations}
              activeConvId={s.conv.activeConvId}
              isUserMenuOpen={s.isUserMenuOpen}
              setIsUserMenuOpen={s.setIsUserMenuOpen}
              setIsSettingsOpen={s.setIsSettingsOpen}
              setIsApiOpen={s.setIsApiOpen}
              setSelectedAgentId={s.setSelectedAgentId}
              setActiveConvId={s.conv.setActiveConvId}
              setInputValue={() => {}}
              setConversations={s.conv.setConversations}
              onNewChat={s.handleNewChat}
              toggleTeam={s.teamMgmt.toggleTeam}
              handleAddTeam={s.teamMgmt.handleAddTeam}
              handleAddAgent={s.teamMgmt.handleAddAgent}
              handleDeleteTeam={s.teamMgmt.handleDeleteTeam}
              handleDeleteAgent={s.teamMgmt.handleDeleteAgent}
              handleRenameTeam={s.teamMgmt.handleRename}
              handleRenameAgent={s.teamMgmt.handleRenameAgent}
              handleTogglePinTeam={s.teamMgmt.handleTogglePinTeam}
              handleAgentClick={(_agent) => { s.setSelectedAgentId(_agent.id); }}
              onEditAgent={(agent) => { s.setConfiguringAgent(agent); }}
              onTeamChat={(teamId) => {
                if (s.apiMessages.length > 0 && s.conv.activeConvId) { s.conv.updateConversationMessages(s.conv.activeConvId, s.apiMessages); }
                s.resetApi();
                useChatStore.getState().setActiveTeam(teamId);
                s.conv.setActiveConvId(null);
                s.setSelectedAgentId(null);
              }}
              isSidebarOpen={s.isSidebarOpen}
              onToggleSidebar={() => s.setIsSidebarOpen(false)}
              onOpenWorkstation={() => { s.setIsWorkstationOpen(true); }}
            />

              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="h-14 flex items-center justify-between px-4 flex-shrink-0 z-40 bg-[var(--color-surface-overlay)] border-b border-b-[var(--color-border-subtle)]">
                  <div className="flex items-center gap-3">
                    {!s.isSidebarOpen && (
                      <button className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] cursor-pointer transition-[color,background] duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" onClick={() => s.setIsSidebarOpen(true)} aria-label="Expand sidebar">
                        <PanelLeft size={18} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                  <button className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] cursor-pointer relative transition-[color,background] duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" onClick={() => {
  const currentTheme = s.settings.theme;
  if (currentTheme === 'system') {
    s.updateSettings({ theme: 'dark' });
  } else {
    s.updateSettings({ theme: currentTheme === 'dark' ? 'light' : 'dark' });
  }
}} aria-label="Toggle dark mode">
                    {s.isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                  <button className="flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] cursor-pointer relative transition-[color,background] duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" aria-label="Notifications">
                    <Bell size={16} />
                    <span className="absolute -top-[2px] -right-[2px] w-2 h-2 rounded-full bg-[var(--color-danger)] border-2 border-[var(--color-surface-card)]" />
                  </button>
                </div>
              </header>

                <main className={`flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[var(--color-surface)] ${s.isPageDragOver ? 'ring-2 ring-inset ring-[var(--color-accent)]' : ''}`} id="main-content"
                onDragOver={s.handlePageDragOver} onDragLeave={s.handlePageDragLeave} onDrop={s.handlePageDrop}>
                  <div className="flex-1 flex flex-col overflow-hidden">
                  {s.isPageDragOver && (
                    <div className="fixed inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-overlay))] border-[3px] border-dashed border-[var(--color-accent)] z-[900] text-xl font-bold text-[var(--color-accent)] pointer-events-none animate-[fadeIn_0.15s_ease]">
                      <span>{s.t('fileAttach.dropHere')}</span>
                    </div>
                  )}
                  {s.wsStatus === 'reconnecting' && (
                    <div className="px-4 py-2 bg-[var(--color-accent-soft)] text-[var(--color-text-on-accent)] text-center text-sm font-medium animate-[fadeIn_0.3s_ease]" role="status" aria-live="polite">
                      {s.t('common.connecting')}...
                    </div>
                  )}
                  {s.apiStatus === 'error' && s.apiError && (
                    <div className="px-4 py-2 bg-[var(--color-danger)] text-[var(--color-text-on-accent)] text-center text-sm font-medium animate-[fadeIn_0.3s_ease] flex items-center justify-center gap-3" role="alert">
                      {s.apiError}
                      <button className="bg-[var(--color-surface)] text-[var(--color-danger)] border-none py-[1px] px-3 rounded text-sm cursor-pointer font-semibold leading-[var(--da-line-height)] hover:opacity-80" onClick={s.retryApi}>
                        {s.t('common.retry')}
                      </button>
                    </div>
                  )}

                    <div className="flex-1 overflow-y-auto flex flex-col bg-[var(--color-surface)]" ref={messagesContainerRef}>
                    {s.showAgentChat || s.hasMessages ? (
                      <MessagesPanel
                        showAgentChat={s.showAgentChat}
                        hasMessages={s.hasMessages}
                        selectedAgentId={s.selectedAgentId}
                        activeTeamId={s.activeTeamId}
                        welcomeDismissed={s.welcomeDismissed}
                        allAgents={s.allAgents}
                        displayMessages={s.displayMessages}
                        messagesEndRef={messagesEndRef}
                        onDismissWelcome={() => s.setWelcomeDismissed(true)}
                      />
                    ) : (
                      <HomeScreen
                        conversationKey={s.conversationKey}
                        models={s.models}
                        selectedModel={s.effectiveSelectedModel}
                        onModelChange={s.setSelectedModel}
                        commands={s.allCommands}
                        onSend={s.handleHomeSend}
                        onExecuteCommand={s.handleExecuteCommand}
                        onConfigureModels={() => s.setIsApiOpen(true)}
                        inputToolbarRef={inputToolbarRef}
                        isRunning={s.apiStatus === 'loading' || s.apiStatus === 'running'}
                        onStop={s.cancelRun}
                      />
                    )}
                  </div>

                  {(s.showAgentChat || s.hasMessages) && (
                    <InputToolbar
                      ref={inputToolbarRef}
                      onSend={s.handleSendMessage}
                      models={s.models}
                      selectedModel={s.effectiveSelectedModel}
                      onModelChange={s.setSelectedModel}
                      placeholder={s.t('home.placeholder')}
                      commands={s.allCommands}
                      onExecuteCommand={s.handleExecuteCommand}
                      onConfigureModels={() => s.setIsApiOpen(true)}
                      isRunning={s.apiStatus === 'loading' || s.apiStatus === 'running'}
                      onStop={s.cancelRun}
                    />
                  )}
                </div>
              </main>
            </div>
          </div>

          <Workspace
            selectedAgentId={s.selectedAgentId}
            activeTab={s.activeWorkspaceTab}
            setActiveTab={s.setActiveWorkspaceTab}
            isWorkspaceOpen={s.isWorkspaceOpen}
            setIsWorkspaceOpen={s.setIsWorkspaceOpen}
            toggleWorkspaceFullscreen={s.toggleWorkspaceFullscreen}
            workspaceRef={workspaceRef}
          />

          <Modals
            configuringAgent={s.configuringAgent}
            isSettingsOpen={s.isSettingsOpen}
            isApiOpen={s.isApiOpen}
            confirmDialog={s.confirmDialog}
            isNewProjectOpen={s.isNewProjectOpen}
            onCloseAgentConfig={s.handleCloseAgentConfig}
            onSaveAgent={s.handleSaveAgent}
            onCloseSettings={s.handleCloseSettings}
            onCloseApi={s.handleCloseApi}
            onCloseConfirm={s.handleCloseConfirm}
            onCloseNewProject={s.handleCloseNewProject}
          />

        </div>
      )}
    </>
  );
}
