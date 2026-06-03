import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import type { Agent, Team, WorkspaceTab, Message } from '../../types/devagents';
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

export default function DevAgentsWorkstation() {
  const workspaceRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
  const loadConversation = useChatStore((s) => s.loadConversation);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);
  const [conversationKey, setConversationKey] = useState(0);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('code');
  const [selectedModel, setSelectedModel] = useState('');
  const showAgentChat = selectedAgentId !== null;

  const filteredConversations = useMemo(() => {
    if (!selectedAgentId) return conv.conversations;
    return conv.conversations.filter(c => !c.agentId || c.agentId === selectedAgentId);
  }, [conv.conversations, selectedAgentId]);

  // Auto-select first available model
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [selectedModel, models]);
  const hasMessages = apiMessages.length > 0;
  const convRef = useRef(conv);
  useEffect(() => { convRef.current = conv; });
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [apiMessages, selectedAgentId]);
  useEffect(() => {
    const activeId = convRef.current.activeConvId;
    if (activeId && apiMessages.length > 0) {
      convRef.current.updateConversationMessages(activeId, apiMessages);
    }
  }, [apiMessages]);
  useEffect(() => {
    const activeId = conv.activeConvId;
    if (activeId) {
      const found = filteredConversations.find(c => c.id === activeId);
      if (found && found.messages.length > 0) {
        const chatMessages: import('../../types').ChatMessage[] = found.messages.map(m => ({
          id: String(m.id),
          role: m.role === 'user' ? 'user' : 'agent',
          agent_name: m.agentId ?? (m.role === 'user' ? '我' : 'Agent'),
          content: m.content,
          round_number: 0,
          created_at: m.timestamp ? new Date(m.timestamp).toISOString() : null,
        }));
        loadConversation(chatMessages);
      }
    }
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
      const convId = conv.activeConvId ?? conv.saveConversation(text, [], selectedAgentId ?? undefined);
      if (convId) conv.setActiveConvId(convId);
      submitToApi(text).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [conv, submitToApi, notify],
  );

  const { isPageDragOver, handlePageDragOver, handlePageDragLeave, handlePageDrop } = useDragAndDrop(inputToolbarRef);
  const toggleWorkspaceFullscreen = useCallback(async () => {
    if (!workspaceRef.current) return;
    try {
      if (!document.fullscreenElement) await workspaceRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */}
  }, []);

  const handleSidebarAddAgent = useCallback((e: React.MouseEvent, id: string) => { e.stopPropagation(); teamMgmt.handleAddAgent(id); }, [teamMgmt]);
  const handleSidebarStartEditTeam = useCallback((e: React.MouseEvent, team: Team) => { e.stopPropagation(); teamMgmt.startEditTeam(team); }, [teamMgmt]);
  const handleSidebarDeleteTeam = useCallback((e: React.MouseEvent, teamId: string) => { e.stopPropagation();
    setConfirmDialog({ title: t('sidebar.deleteTeam'), message: t('confirm.deleteTeam'), danger: true, onConfirm: () => { teamMgmt.handleDeleteTeam(teamId); setConfirmDialog(null); } });
  }, [teamMgmt, t]);
  const handleSidebarDeleteAgent = useCallback((e: React.MouseEvent, teamId: string, agentId: string) => { e.stopPropagation();
    setConfirmDialog({ title: t('sidebar.deleteAgent'), message: t('confirm.deleteAgent'), danger: true, onConfirm: () => { teamMgmt.handleDeleteAgent(teamId, agentId); setConfirmDialog(null); } });
  }, [teamMgmt, t]);
  const selectAgent = useCallback((agent: Agent) => { setSelectedAgentId(agent.id); setIsWorkspaceOpen(false); }, []);
  const openAgentConfig = useCallback((e: React.MouseEvent, agent: Agent) => { e.stopPropagation(); setConfiguringAgent(agent); }, []);
  
  const handleSaveAgent = useCallback(async (agent: Agent) => {
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
      try {
        await updateAgent(agent.id, cfg);
      } catch (updateErr: any) {
        if (updateErr?.response?.status === 404 || updateErr?.status === 404) {
          await createAgent({
            ...cfg,
            role_identifier: agent.role || 'agent_' + agent.id.slice(0, 8),
            order: 0,
            is_active: true,
            is_approver: false,
            icon: '🤖',
          });
        } else {
          throw updateErr;
        }
      }
      setConfiguringAgent(null);
      toast(t('common.saved'), 'success');
    } catch (err) {
      Logger.error('Failed to save agent config', err);
      toast(t('common.error'), 'error');
    }
  }, [toast, t]);
  const allCommands = [...(apiCommands ?? []).map(c => ({ id: c.id, name: c.name, description: c.description, source: 'local' as const })), ...agentCommands];
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

  const getFallbackId = (() => { let i = 0; return () => ++i; })();
  const displayMessages: Message[] = apiMessages.map((m) => {
    const fallbackId = getFallbackId();
    return {
      id: parseInt(m.id, 36) || fallbackId,
      role: m.role === 'user' ? 'user' : 'agent',
      agentId: m.role,
      content: m.content,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : fallbackId,
    };
  });

  return (
    <div className="devagents-layout">
      <DevAgentsSidebar
        teams={teamMgmt.teams}
        selectedAgentId={selectedAgentId}
        editingTeamId={teamMgmt.editingTeamId}
        editTeamName={teamMgmt.editTeamName}
        setEditTeamName={teamMgmt.setEditTeamName}
        conversations={filteredConversations}
        activeConvId={conv.activeConvId}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsApiOpen={setIsApiOpen}
        setSelectedAgentId={setSelectedAgentId}
        setActiveConvId={conv.setActiveConvId}
        setInputValue={() => {}}
        setConversationKey={setConversationKey}
        setConversations={conv.setConversations}
        onNewChat={handleNewChat}
        toggleTeam={teamMgmt.toggleTeam}
        handleAddTeam={teamMgmt.handleAddTeam}
        handleAddAgent={handleSidebarAddAgent}
        startEditTeam={handleSidebarStartEditTeam}
        saveTeamName={teamMgmt.saveTeamName}
        handleTeamNameKeyDown={teamMgmt.handleTeamNameKeyDown}
        handleDeleteTeam={handleSidebarDeleteTeam}
        handleDeleteAgent={handleSidebarDeleteAgent}
        handleAgentClick={selectAgent}
        handleOpenAgentConfig={openAgentConfig}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
      {isSidebarOpen && <div className="devagents-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      <main
        className={`devagents-main ${isPageDragOver ? 'devagents-drag-over' : ''}`}
        id="main-content"
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        {isPageDragOver && (
          <div className="devagents-page-drop-overlay">
            <span>{t('fileAttach.dropHere')}</span>
          </div>
        )}
        {wsStatus === 'reconnecting' && <div className="devagents-ws-banner" role="status" aria-live="polite">{t('common.connecting')}...</div>}
        {apiStatus === 'error' && apiError && (
          <div className="devagents-ws-banner devagents-ws-banner--error" role="alert">
            {apiError}
          </div>
        )}
        <button className="devagents-hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle sidebar">
          <MessageSquare size={18} />
        </button>

        {(showAgentChat || hasMessages) && (
          <header className="devagents-header">
            <div className="devagents-header-title">
              {showAgentChat ? (() => {
                const agent = teamMgmt.allAgents.find(a => a.id === selectedAgentId);
                return agent ? (
                  <><div className={`devagents-agent-icon-sm ${agent.bg} ${agent.border}`}><agent.icon size={14} className={agent.color} /></div>{agent.name}</>
                ) : <><MessageSquare size={16} /></>;
              })() : (
                <><MessageSquare size={16} /><span>{t('home.title')}</span></>
              )}
              <button onClick={() => {
                if (showAgentChat) {
                  setSelectedAgentId(null);
                } else {
                  resetApi();
                }
              }} className="devagents-back-btn" title="返回">
                <ChevronRight size={14} className="rotate-180" />{t('workspace.back')}
              </button>
            </div>
          </header>
        )}

        <div className="devagents-messages">
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
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              commands={allCommands}
              onSend={handleHomeSend}
              onExecuteCommand={handleExecuteCommand}
              onConfigureModels={() => setIsApiOpen(true)}
              inputToolbarRef={inputToolbarRef}
            />
          )}
        </div>

        {(showAgentChat || hasMessages) && (
          <InputToolbar
            ref={inputToolbarRef}
            onSend={handleSendMessage}
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            placeholder={t('chatInput.placeholder')}
            commands={allCommands}
            onExecuteCommand={handleExecuteCommand}
            onConfigureModels={() => setIsApiOpen(true)}
          />
        )}
      </main>

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
        onCloseAgentConfig={() => setConfiguringAgent(null)}
        onSaveAgent={handleSaveAgent}
        onCloseSettings={() => setIsSettingsOpen(false)}
        onCloseApi={() => setIsApiOpen(false)}
        onCloseConfirm={() => setConfirmDialog(null)}
        onCloseNewProject={() => setIsNewProjectOpen(false)}
      />
    </div>
  );
}
