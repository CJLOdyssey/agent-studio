import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Agent, WorkspaceTab, Message } from '../../types/AgentStudio';
import { useToast } from '../../utils/useToast';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { useConversation } from '../../hooks/useConversation';
import { useNotificationSound, useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import type { InputToolbarHandle, AttachedFile } from '../input';
import { useAgents, useAvailableModels, useCommands } from '../../api/hooks';
import { executeCommand } from '../../api/client';
import { useAgentCommands } from '../../hooks/useAgentCommands';
import { useChatStore } from '../../stores/chatStore';
import { submitRequirement, retry } from '../../stores/chatActions';
import { useDragAndDrop } from './useDragAndDrop';
import Logger from '../../utils/logger';

export function useWorkstationState(
  messagesContainerRef: React.RefObject<HTMLDivElement | null>,
  workspaceRef: React.RefObject<HTMLElement | null>,
  inputToolbarRef: React.RefObject<InputToolbarHandle | null>,
) {
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
  const submitToApi = submitRequirement;
  const resetApi = useChatStore((s) => s.reset);
  const cancelRun = useChatStore((s) => s.cancelRun);
  const retryApi = retry;
  const loadConversation = useChatStore((s) => s.loadConversation);
  const abandonedRunId = useChatStore((s) => s.lastAbandonedRunId);

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
  const { settings, updateSettings } = useSettings();
  const isDarkMode = settings.theme === 'dark';
  const activeTeamId = useChatStore((s) => s.activeTeamId);
  const activeTeamName = useMemo(() => {
    if (!activeTeamId) return undefined;
    return teamMgmt.teams.find(t => t.id === activeTeamId)?.name;
  }, [activeTeamId, teamMgmt.teams]);
  const showAgentChat = selectedAgentId !== null || activeTeamId !== null;

  const filteredConversations = useMemo(() => conv.conversations, [conv.conversations]);

  const effectiveSelectedModel = useMemo(
    () => selectedModel || (models.length > 0 ? models[0].id : ''),
    [selectedModel, models],
  );
  const hasMessages = apiMessages.length > 0;
  const convRef = useRef(conv);
  useEffect(() => {
    convRef.current = conv;
  });

  const lastMsgLen = apiMessages.length;
  const lastMsgStream = useMemo(() => {
    const m = apiMessages[apiMessages.length - 1];
    if (!m) return '';
    return `${m.thinking ?? ''}|${m.content ?? ''}`;
  }, [apiMessages]);

  useEffect(() => {
    if (abandonedRunId) {
      toast(t('toast.requestAbandoned'), 'info');
    }
  }, [abandonedRunId, toast, t]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [lastMsgLen, lastMsgStream, messagesContainerRef]);

  useEffect(() => {
    if (apiStatus === 'loading' || apiStatus === 'running') return;
    const activeId = convRef.current.activeConvId;
    if (activeId) {
      const state = useChatStore.getState();
      if (state.messages.length > 0) {
        convRef.current.updateConversationMessages(activeId, state.messages, false, activeTeamId ?? undefined, activeTeamName);
      }
      if (state.currentSessionId) {
        convRef.current.updateConversationSessionId(activeId, state.currentSessionId, false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMessages, apiStatus]);

  useEffect(() => {
    const activeId = conv.activeConvId;
    if (!activeId) return;
    const found = filteredConversations.find((c) => c.id === activeId);
    if (!found || found.messages.length === 0) { resetApi(); return; }

    const chatMessages: import('../../types').ChatMessage[] = found.messages.map((m, idx) => ({
      id: typeof m.id === 'number' ? `${activeId}-${idx}` : m.id,
      role: m.role === 'user' ? 'user' : 'agent',
      agent_name: m.agentId ?? (m.role === 'user' ? '我' : 'Agent'),
      content: m.content,
      thinking: m.thinking ?? undefined,
      thinkingDone: m.thinkingDone === true || Boolean(m.thinking && !m.interrupted),
      versions: m.versions ?? undefined,
      currentVersion: m.currentVersion ?? undefined,
      thumbsFeedback: m.thumbsFeedback ?? undefined,
      interrupted: m.interrupted ?? undefined,
      round_number: 0,
      created_at: m.timestamp
        ? new Date(m.timestamp).toISOString()
        : Reflect.get(m, 'created_at')
          ? String(Reflect.get(m, 'created_at'))
          : found.createdAt && found.updatedAt && found.messages.length > 0
            ? new Date(
                new Date(found.createdAt).getTime() +
                (new Date(found.updatedAt).getTime() - new Date(found.createdAt).getTime()) *
                ((idx + 0.5) / found.messages.length)
              ).toISOString()
            : null,
    }));
    const current = useChatStore.getState().messages;
    for (const msg of chatMessages) {
      if (!msg.thinking) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.thinking) msg.thinking = live.thinking;
      }
      if (!msg.versions) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.versions) { msg.versions = live.versions; msg.currentVersion = live.currentVersion; }
      }
      if (!msg.thumbsFeedback) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.thumbsFeedback) msg.thumbsFeedback = live.thumbsFeedback;
      }
      if (!msg.thinkingDone) {
        const live = current.find((c) => c.content === msg.content && c.role === msg.role);
        if (live?.thinkingDone) msg.thinkingDone = true;
      }
    }
    loadConversation(chatMessages, found.id, found.sessionId);
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
  }, [apiMessages, conv, resetApi]);

  const handleSendMessage = useCallback(
    (text: string, _files: AttachedFile[]) => {
      if (!conv.activeConvId) {
        const tName = teamMgmt.teams.find(t => t.id === activeTeamId)?.name;
        conv.saveConversation(text, [], selectedAgentId ?? undefined, activeTeamId ?? undefined, tName);
      }
      submitToApi(text, undefined, selectedAgentId ?? undefined).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [submitToApi, selectedAgentId, notify, conv, activeTeamId, teamMgmt.teams],
  );

  const handleHomeSend = useCallback(
    (text: string, _files: AttachedFile[]) => {
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const convId = conv.activeConvId ?? conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined);
      if (convId) conv.setActiveConvId(convId);
      submitToApi(text, undefined, undefined, false).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [conv, submitToApi, notify, selectedAgentId],
  );

  const { isPageDragOver, handlePageDragOver, handlePageDragLeave, handlePageDrop } = useDragAndDrop(inputToolbarRef as React.RefObject<InputToolbarHandle>);

  const toggleWorkspaceFullscreen = useCallback(async () => {
    if (!workspaceRef.current) return;
    try {
      if (!document.fullscreenElement) await workspaceRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  }, [workspaceRef]);

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
              order: 0, is_active: false, is_approver: false, icon: '🤖',
            });
            const team = teamMgmt.teams.find((t) => t.agents.some((a) => a.id === oldId));
            agent.id = created.id;
            teamMgmt.replaceAgentId(oldId, created.id);
            if (team) teamMgmt.linkMemberAgent(team.id, oldId, created.id);
          } else { throw updateErr; }
        }
        setConfiguringAgent(null);
        toast(t('toast.saveSuccess'), 'success');
      } catch {
        toast(t('toast.saveFailed'), 'error');
      }
    },
    [teamMgmt, toast, t],
  );

  const currentSessionId = useChatStore((s) => s.currentSessionId);

  const handleExecuteCommand = useCallback(
    async (cmd: string) => {
      if (!currentSessionId) return;
      try {
        const result = await executeCommand(cmd, currentSessionId);
        if (result.success) {
          toast(result.message, 'success');
          conv.setConversations([...conv.conversations]);
        } else {
          toast(result.message, 'error');
        }
      } catch {
        toast(t('toast.error'), 'error');
      }
    },
    [currentSessionId, toast, t, conv],
  );

  const displayMessages: Message[] = apiMessages.map((m) => ({
    id: m.id,
    role: m.role === 'user' ? 'user' : 'agent',
    agentId: m.role,
    content: m.content,
    thinking: m.thinking,
    thinkingDone: m.thinkingDone === true,
    timestamp: m.created_at ? new Date(m.created_at).getTime() : 0,
    versions: m.versions,
    currentVersion: m.currentVersion,
    thumbsFeedback: m.thumbsFeedback,
    interrupted: m.interrupted,
  }));

  const handleCloseAgentConfig = useCallback(() => setConfiguringAgent(null), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleCloseApi = useCallback(() => setIsApiOpen(false), []);
  const handleCloseConfirm = useCallback(() => setConfirmDialog(null), []);
  const handleCloseNewProject = useCallback(() => setIsNewProjectOpen(false), []);

  const allCommands = useMemo(
    () => [...(apiCommands || []), ...agentCommands],
    [apiCommands, agentCommands],
  );

  const allAgents = teamMgmt.allAgents;

  return {

    toast,
    t,
    notify,
    teamMgmt,
    conv,
    apiCommands,
    models,
    agentCommands,
    apiMessages,
    apiStatus,
    apiError,
    wsStatus,
    submitToApi,
    resetApi,
    cancelRun,
    retryApi,
    loadConversation,
    abandonedRunId,
    selectedAgentId,
    setSelectedAgentId,
    configuringAgent,
    setConfiguringAgent,
    isUserMenuOpen,
    setIsUserMenuOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isApiOpen,
    setIsApiOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    welcomeDismissed,
    setWelcomeDismissed,
    isNewProjectOpen,
    setIsNewProjectOpen,
    confirmDialog,
    setConfirmDialog,
    conversationKey,
    setConversationKey,
    isWorkspaceOpen,
    setIsWorkspaceOpen,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    selectedModel,
    setSelectedModel,
    isWorkstationOpen,
    setIsWorkstationOpen,
    settings,
    updateSettings,
    isDarkMode,
    activeTeamId,
    activeTeamName,
    showAgentChat,
    filteredConversations,
    effectiveSelectedModel,
    hasMessages,
    isPageDragOver,
    handlePageDragOver,
    handlePageDragLeave,
    handlePageDrop,
    toggleWorkspaceFullscreen,
    handleNewChat,
    handleSendMessage,
    handleHomeSend,
    handleSaveAgent,
    handleExecuteCommand,
    handleCloseAgentConfig,
    handleCloseSettings,
    handleCloseApi,
    handleCloseConfirm,
    handleCloseNewProject,
    displayMessages,
    allCommands,
    allAgents,
  };
}
