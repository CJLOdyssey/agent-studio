import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PanelLeft, Sun, Moon, Bell } from 'lucide-react';
import type { Agent, WorkspaceTab, Message } from '../../types/devagents';
import DevAgentsSidebar from './DevAgentsSidebar';
import Workspace from './workspace/Workspace';
import { useToast } from '../../utils/useToast';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { useConversation } from '../../hooks/useConversation';
import { useNotificationSound } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { InputToolbar, type InputToolbarHandle, type AttachedFile } from '../input';
import { useAgents, useAvailableModels, useCommands } from '../../api/hooks';
import { executeCommand } from '../../api/client';
import { useAgentCommands } from '../../hooks/useAgentCommands';
import { useChatStore } from '../../stores/chatStore';
import HomeScreen from './HomeScreen';
import MessagesPanel from './MessagesPanel';
import Modals from './Modals';
import { useDragAndDrop } from './useDragAndDrop';
import Logger from '../../utils/logger';
import WorkstationPage from './WorkstationPage';

export default function DevAgentsWorkstation() {
  const workspaceRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputToolbarRef = useRef<InputToolbarHandle>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const notify = useNotificationSound();

  const teamMgmt = useTeamManagement();
  const conv = useConversation();
  useAgents();
  const { data: apiCommands } = useCommands();
  const models = useAvailableModels();
  const agentCommands = useAgentCommands(teamMgmt.teams);

  const apiMessages = useChatStore((s) => s.messages);
  const apiStatus = useChatStore((s) => s.status);
  const apiError = useChatStore((s) => s.error);
  const wsStatus = useChatStore((s) => s.wsStatus);
  const submitToApi = useChatStore((s) => s.submitRequirement);
  const resetApi = useChatStore((s) => s.reset);
  const cancelRun = useChatStore((s) => s.cancelRun);
  const retryApi = useChatStore((s) => s.retry);
  const loadConversation = useChatStore((s) => s.loadConversation);
  const abandonedRunId = useChatStore((s) => s.lastAbandonedRunId);

  // Toast when a running response is abandoned by switching conversations
  useEffect(() => {
    if (abandonedRunId) {
      toast(t('toast.requestAbandoned'), 'info');
    }
  }, [abandonedRunId, toast, t]);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [conversationKey, setConversationKey] = useState(0);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('code');
  const [selectedModel, setSelectedModel] = useState('');
  const [isWorkstationOpen, setIsWorkstationOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('devagents-dark-mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  const showAgentChat = selectedAgentId !== null;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('devagents-dark-mode', String(isDarkMode));
  }, [isDarkMode]);

  const filteredConversations = useMemo(() => {
    if (!selectedAgentId) return conv.conversations;
    return conv.conversations.filter((c) => !c.agentId || c.agentId === selectedAgentId);
  }, [conv.conversations, selectedAgentId]);

  const effectiveSelectedModel = useMemo(
    () => selectedModel || (models.length > 0 ? models[0].id : ''),
    [selectedModel, models],
  );
  const hasMessages = apiMessages.length > 0;
  const convRef = useRef(conv);
  useEffect(() => {
    convRef.current = conv;
  });

  // Track last message content for streaming auto-scroll.
  // Combines both length (new msg) and thinking/content (streaming) as trigger.
  const lastMsgLen = apiMessages.length;
  const lastMsgStream = (() => {
    const m = apiMessages[apiMessages.length - 1];
    if (!m) return '';
    return `${m.thinking ?? ''}|${m.content ?? ''}`;
  })();
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Explicit 'auto' overrides CSS scroll-behavior: smooth which can't keep up
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [lastMsgLen, lastMsgStream]);
  useEffect(() => {
    // Skip conversation sync during active streaming to avoid infinite re-render loop
    // (thinking_stream → new messages array → effect fires → conversation update → re-render → loop)
    // Sync when streaming is done (completed/error) or idle.
    if (apiStatus === 'loading' || apiStatus === 'running') return;
    const activeId = convRef.current.activeConvId;
    if (activeId) {
      const state = useChatStore.getState();
      if (state.messages.length > 0) {
        Logger.debug(`[chat] sync effect: saving ${state.messages.length} msgs to conv ${activeId} (status=${apiStatus})`);
        convRef.current.updateConversationMessages(activeId, state.messages);
      }
      if (state.currentSessionId) {
        convRef.current.updateConversationSessionId(activeId, state.currentSessionId);
      }
    }
  }, [apiMessages, apiStatus]);
  useEffect(() => {
    const activeId = conv.activeConvId;
    if (!activeId) return;
    const found = filteredConversations.find((c) => c.id === activeId);
    if (!found || found.messages.length === 0) { resetApi(); return; }

    Logger.debug(`[chat] loading conv ${activeId} with ${found.messages.length} msgs`);
    const chatMessages: import('../../types').ChatMessage[] = found.messages.map((m, idx) => ({
      id: typeof m.id === 'number' ? `${activeId}-${idx}` : m.id,
      role: m.role === 'user' ? 'user' : 'agent',
      agent_name: m.agentId ?? (m.role === 'user' ? '我' : 'Agent'),
      content: m.content,
      thinking: (m as any).thinking ?? undefined,
      versions: (m as any).versions ?? undefined,
      currentVersion: (m as any).currentVersion ?? undefined,
      thumbsFeedback: (m as any).thumbsFeedback ?? undefined,
      round_number: 0,
      created_at: m.timestamp ? new Date(m.timestamp).toISOString() : null,
    }));
    // Carry over thinking and version data from live chatStore messages (conversation cache may lack it)
    const current = useChatStore.getState().messages;
    for (const msg of chatMessages) {
      if (!msg.thinking) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.thinking) msg.thinking = live.thinking;
      }
      if (!msg.versions) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.versions) {
          msg.versions = live.versions;
          msg.currentVersion = live.currentVersion;
        }
      }
      if (!msg.thumbsFeedback) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.thumbsFeedback) msg.thumbsFeedback = live.thumbsFeedback;
      }
    }
    loadConversation(chatMessages, found.id, found.sessionId);
    // Only react to activeConvId changes — filteredConversations is read via snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.activeConvId]);
  const handleNewChat = useCallback(() => {
    if (apiMessages.length > 0 && conv.activeConvId) {
      conv.updateConversationMessages(conv.activeConvId, apiMessages);
    }
    resetApi();
    setSelectedAgentId(null);
    conv.setActiveConvId(null);
    setConversationKey((prev) => prev + 1);
  }, [apiMessages, conv, resetApi, setSelectedAgentId, setConversationKey]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewChat();
        toast(t('toast.newChat'), 'info');
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [t, toast, handleNewChat]);
  const handleSendMessage = useCallback(
    (text: string, _files: AttachedFile[]) => {
      submitToApi(text, undefined, selectedAgentId ?? undefined).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [submitToApi, selectedAgentId, notify],
  );
  const handleHomeSend = useCallback(
    (text: string, _files: AttachedFile[]) => {
      const userMessage: import('../../types/devagents').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const convId = conv.activeConvId ?? conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined);
      if (convId) conv.setActiveConvId(convId);
      submitToApi(text, undefined, undefined, true).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [conv, submitToApi, notify, selectedAgentId],
  );

  const { isPageDragOver, handlePageDragOver, handlePageDragLeave, handlePageDrop } = useDragAndDrop(inputToolbarRef);
  const toggleWorkspaceFullscreen = useCallback(async () => {
    if (!workspaceRef.current) return;
    try {
      if (!document.fullscreenElement) await workspaceRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  const handleSaveAgent = useCallback(
    async (agent: Agent) => {
      try {
        const { updateAgent, createAgent } = await import('../../api/client/agents');
        const cfg = {
          name: agent.name,
          system_prompt: agent.systemPrompt || '',
          output_constraints: agent.outputConstraints || undefined,
          tools: agent.tools || undefined,
          mcp: agent.mcp || undefined,
          skills: agent.skills || undefined,
        };
        const oldId = agent.id;
        try {
          await updateAgent(oldId, cfg);
        } catch (updateErr: unknown) {
          const ue = updateErr as { response?: { status?: number }; status?: number };
          if (ue.response?.status === 404 || ue.status === 404) {
            const created = await createAgent({
              ...cfg,
              role_identifier: 'agent_' + (crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10))).slice(0, 8),
              order: 0,
              is_active: true,
              is_approver: false,
              icon: '🤖',
            });
            const team = teamMgmt.teams.find((t) => t.agents.some((a) => a.id === oldId));
            agent.id = created.id;
            teamMgmt.replaceAgentId(oldId, created.id);
            if (team) teamMgmt.linkMemberAgent(team.id, oldId, created.id);
          } else {
            throw updateErr;
          }
        }
        setTimeout(() => {
          teamMgmt.handleAgentConfigSave(agent);
          toast(t('common.saved'), 'success');
          setConfiguringAgent(null);
        }, 0);
      } catch (err) {
        Logger.error('Failed to save agent config', err);
        toast(t('common.error'), 'error');
      }
    },
    [toast, t, teamMgmt],
  );

  const handleCloseAgentConfig = useCallback(() => setConfiguringAgent(null), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleCloseApi = useCallback(() => setIsApiOpen(false), []);
  const handleCloseConfirm = useCallback(() => setConfirmDialog(null), []);
  const handleCloseNewProject = useCallback(() => setIsNewProjectOpen(false), []);

  const allCommands = [
    ...(apiCommands ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      source: 'local' as const,
    })),
    ...agentCommands,
  ];
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const handleExecuteCommand = useCallback(
    async (commandId: string) => {
      if (!currentSessionId) {
        toast(t('common.noSession'), 'error');
        return;
      }
      try {
        const result = await executeCommand(commandId, currentSessionId);
        if (result.success) {
          toast(result.message, 'info');
        } else {
          toast(result.message, 'error');
        }
      } catch {
        toast(t('toast.error'), 'error');
      }
    },
    [currentSessionId, toast, t],
  );

  console.log('[render] apiMessages count:', apiMessages.length, 'thinking:', apiMessages.map(m => ({id: m.id?.substring(0,8), t: (m.thinking || '').substring(0,20), td: m.thinkingDone})));

  const displayMessages: Message[] = apiMessages.map((m) => ({
    id: m.id,
    role: m.role === 'user' ? 'user' : 'agent',
    agentId: m.role,
    content: m.content,
    thinking: m.thinking,
    thinkingDone: m.thinkingDone === true,
    timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    versions: (m as any).versions,
    currentVersion: (m as any).currentVersion,
    thumbsFeedback: (m as any).thumbsFeedback,
  }));

  return (
    <div className="devagents-app">
      <div className="devagents-body">
        {isSidebarOpen && (
          <div className="devagents-mobile-overlay visible" onClick={() => setIsSidebarOpen(false)} />
        )}

        <DevAgentsSidebar
        teams={teamMgmt.teams}
        selectedAgentId={selectedAgentId}
        conversations={filteredConversations}
        activeConvId={conv.activeConvId}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsApiOpen={setIsApiOpen}
        setSelectedAgentId={setSelectedAgentId}
        setActiveConvId={conv.setActiveConvId}
        setInputValue={() => {}}
        setConversations={conv.setConversations}
        onNewChat={handleNewChat}
        toggleTeam={teamMgmt.toggleTeam}
        handleAddTeam={teamMgmt.handleAddTeam}
        handleAddAgent={teamMgmt.handleAddAgent}
        handleDeleteTeam={teamMgmt.handleDeleteTeam}
        handleDeleteAgent={teamMgmt.handleDeleteAgent}
        handleRenameTeam={teamMgmt.handleRename}
        handleRenameAgent={teamMgmt.handleRenameAgent}
        handleTogglePinTeam={teamMgmt.handleTogglePinTeam}
        handleAgentClick={(agent) => { useChatStore.getState().selectAgent(agent.id); setSelectedAgentId(agent.id); }}
        onEditAgent={(agent) => { setConfiguringAgent(agent); }}
        isSidebarOpen={isSidebarOpen}
        onOpenWorkstation={() => {
          setIsWorkstationOpen(true);
        }}
      />
      <div className="devagents-right">
        <header className="devagents-global-header">
          <div className="devagents-header-left">
            <button
              className="devagents-header-btn"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={18} />
            </button>
          </div>
          <div className="devagents-header-right">
            <button
              className="devagents-header-btn"
              onClick={() => setIsDarkMode(prev => !prev)}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="devagents-header-btn" aria-label="Notifications">
              <Bell size={16} />
              <span className="devagents-header-notif-dot" />
            </button>
          </div>
        </header>
      <main
        className={`devagents-main ${isPageDragOver ? 'devagents-drag-over' : ''}`}
        id="main-content"
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        <div className="devagents-main-bottom">
          {isPageDragOver && (
            <div className="devagents-page-drop-overlay">
              <span>{t('fileAttach.dropHere')}</span>
            </div>
          )}
          {wsStatus === 'reconnecting' && (
            <div className="devagents-ws-banner" role="status" aria-live="polite">
              {t('common.connecting')}...
            </div>
          )}
          {apiStatus === 'error' && apiError && (
            <div className="devagents-ws-banner devagents-ws-banner--error" role="alert">
              {apiError}
              <button className="devagents-retry-btn" onClick={retryApi}>
                {t('common.retry')}
              </button>
            </div>
          )}

        <div className="devagents-messages" ref={messagesContainerRef}>
          {showAgentChat || hasMessages ? (
            <MessagesPanel
              showAgentChat={showAgentChat}
              hasMessages={hasMessages}
              selectedAgentId={selectedAgentId}
              welcomeDismissed={welcomeDismissed}
              allAgents={teamMgmt.allAgents}
              displayMessages={displayMessages}
              messagesEndRef={messagesEndRef}
              onDismissWelcome={() => setWelcomeDismissed(true)}
            />
          ) : (
            <HomeScreen
              conversationKey={conversationKey}
              models={models}
              selectedModel={effectiveSelectedModel}
              onModelChange={setSelectedModel}
              commands={allCommands}
              onSend={handleHomeSend}
              onExecuteCommand={handleExecuteCommand}
              onConfigureModels={() => setIsApiOpen(true)}
              inputToolbarRef={inputToolbarRef}
              isRunning={apiStatus === 'loading' || apiStatus === 'running'}
              onStop={cancelRun}
            />
          )}
        </div>

        {(showAgentChat || hasMessages) && (
          <InputToolbar
            ref={inputToolbarRef}
            onSend={handleSendMessage}
            models={models}
            selectedModel={effectiveSelectedModel}
            onModelChange={setSelectedModel}
            placeholder={t('home.placeholder')}
            commands={allCommands}
            onExecuteCommand={handleExecuteCommand}
            onConfigureModels={() => setIsApiOpen(true)}
            isRunning={apiStatus === 'loading' || apiStatus === 'running'}
            onStop={cancelRun}
          />
        )}
        </div>
      </main>
      </div>
      </div>

      <Workspace
        selectedAgentId={selectedAgentId}
        activeTab={activeWorkspaceTab}
        setActiveTab={setActiveWorkspaceTab}
        isWorkspaceOpen={isWorkspaceOpen}
        setIsWorkspaceOpen={setIsWorkspaceOpen}
        toggleWorkspaceFullscreen={toggleWorkspaceFullscreen}
        workspaceRef={workspaceRef}
      />
      <Modals
        configuringAgent={configuringAgent}
        isSettingsOpen={isSettingsOpen}
        isApiOpen={isApiOpen}
        confirmDialog={confirmDialog}
        isNewProjectOpen={isNewProjectOpen}
        onCloseAgentConfig={handleCloseAgentConfig}
        onSaveAgent={handleSaveAgent}
        onCloseSettings={handleCloseSettings}
        onCloseApi={handleCloseApi}
        onCloseConfirm={handleCloseConfirm}
        onCloseNewProject={handleCloseNewProject}
      />

      {isWorkstationOpen && (
        <div className="devagents-modal-overlay" onClick={() => setIsWorkstationOpen(false)}>
          <div className="devagents-modal devagents-modal--workstation" onClick={(e) => e.stopPropagation()}>
            <div className="devagents-modal-header">
              <h3>管理工作台</h3>
              <button className="devagents-modal-close" onClick={() => setIsWorkstationOpen(false)}>×</button>
            </div>
            <WorkstationPage />
          </div>
        </div>
      )}
    </div>
  );
}
