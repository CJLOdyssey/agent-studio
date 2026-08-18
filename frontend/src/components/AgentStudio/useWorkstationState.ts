import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { getSessionDetail } from '../../api/client/sessions';
import { buildPathTurns } from '../../utils/branchTurns';
import { useDragAndDrop } from './useDragAndDrop';
import { useModelSync } from './useModelSync';
import { useConversationSync } from './useConversationSync';
import { useWorkspaceNavigation } from './useWorkspaceNavigation';
import { useMessageHandlers } from './useMessageHandlers';
import { buildBranchPath } from './workstationUtils';
import Logger from '../../utils/logger';
import type * as React from 'react';

export function useWorkstationState(
  messagesContainerRef: React.RefObject<HTMLDivElement | null>,
  workspaceRef: React.RefObject<HTMLElement | null>,
  inputToolbarRef: React.RefObject<InputToolbarHandle | null>,
) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const notify = useNotificationSound();

  const teamMgmt = useTeamManagement(toast);
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
  const runSessionId = useChatStore((s) => s.currentSessionId);

  const { sessionId, agentId: urlAgentId, teamId: urlTeamId } = useParams();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(urlAgentId ?? null);
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
  const [isWorkstationOpen, setIsWorkstationOpen] = useState(false);
  const { settings, updateSettings } = useSettings();
  const isDarkMode = settings.theme === 'dark';
  const activeTeamId = useChatStore((s) => s.activeTeamId);
  const activeTeamName = useMemo(() => {
    if (!activeTeamId) return undefined;
    return teamMgmt.teams.find(t => t.id === activeTeamId)?.name;
  }, [activeTeamId, teamMgmt.teams]);
  const showAgentChat = selectedAgentId !== null || activeTeamId !== null;
  const navigate = useNavigate();
  const activeConvId = sessionId ?? null;
  const [restoring, setRestoring] = useState<boolean>(
    () => sessionId !== undefined || !!localStorage.getItem('agentstudio-active-conv-id'),
  );

  const filteredConversations = useMemo(() => conv.conversations, [conv.conversations]);

  // Model sync
  const { selectedModel, setSelectedModel, effectiveSelectedModel, ensureModelPersisted } =
    useModelSync(models);

  const setSelectedModelState = setSelectedModel;

  // Conversation sync
  const {
    syncActiveConversation, suppressScrollRef, followBottomRef,
    skipReloadRef, runConvIdRef, pendingTempIdRef, loadSeqRef, buildConvPath,
  } = useConversationSync({
    conv, activeConvId, filteredConversations, resetApi,
    loadConversation: loadConversation as (msgs: import('../../types').ChatMessage[], id: string, sessionId?: string) => void,
    setRestoring, setSelectedAgentId,
    activeTeamId, activeTeamName, apiStatus, urlTeamId, urlAgentId,
    navigate,
  });

  // Workspace navigation
  const { handleNewChat, navigateToConversation } = useWorkspaceNavigation({
    conv, syncActiveConversation, resetApi, setSelectedAgentId,
    setSelectedModelState, setRestoring, setConversationKey,
    navigate, buildConvPath,
  });

  const hasMessages = apiMessages.length > 0;

  // Temp→sessionId confirm
  useEffect(() => {
    if (!runSessionId) return;
    const tempId = pendingTempIdRef.current;
    if (!tempId) return;
    const pending = conv.conversations.find((c) => c.id === tempId);
    if (!pending?.temp || activeConvId !== tempId) {
      pendingTempIdRef.current = null;
      return;
    }
    pendingTempIdRef.current = null;
    conv.confirmConversationSession(tempId, runSessionId);
    runConvIdRef.current = runSessionId;
    skipReloadRef.current = true;
    navigate(buildConvPath({ ...pending, id: runSessionId }), { replace: true });
  }, [runSessionId, conv, navigate, activeConvId, buildConvPath]);

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

  // Scroll management
  const programmaticScrollRef = useRef(false);
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      if (atBottom !== followBottomRef.current) followBottomRef.current = atBottom;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [messagesContainerRef]);

  const prevLenRef = useRef(lastMsgLen);
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    const lenChanged = lastMsgLen !== prevLenRef.current;
    prevLenRef.current = lastMsgLen;
    if (!lenChanged && !followBottomRef.current) return;
    programmaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [lastMsgLen, lastMsgStream, messagesContainerRef]);

  // Sync on run complete or WS disconnect
  useEffect(() => {
    if (apiStatus === 'loading') return;
    if (apiStatus === 'running' && wsStatus !== 'disconnected') return;
    syncActiveConversation(runConvIdRef.current ?? undefined);
  }, [apiMessages, apiStatus, wsStatus, syncActiveConversation]);

  // Branch switch
  const handleSwitchBranch = useCallback(async (runId: string) => {
    const convId = useChatStore.getState().currentSessionId;
    if (!convId) return;
    suppressScrollRef.current = true;
    const seq = ++loadSeqRef.current;
    try {
      const detail = await getSessionDetail(convId);
      if (seq !== loadSeqRef.current) return;
      const currentPath = new Set(
        useChatStore
          .getState()
          .messages.map((m) => m.runId)
          .filter((id): id is string => !!id),
      );
      const path = buildBranchPath(detail.runs ?? [], runId, currentPath);
      const loaded = buildPathTurns(path, detail.runs ?? []);
      for (const m of loaded) {
        if (m.role !== 'user' && m.thinkingDone === undefined) {
          m.thinkingDone = true;
        }
      }
      useChatStore.getState().loadConversation(loaded, convId, convId);
      useChatStore.setState({
        currentRunId: path[path.length - 1]?.id ?? runId,
        activeRunId: path[path.length - 1]?.id ?? runId,
      });
      try {
        localStorage.setItem(
          `agentstudio-branch:${convId}`,
          path[path.length - 1]?.id ?? runId,
        );
      } catch { /* non-fatal */ }
      Logger.info(
        '[switchBranch] run=%s runs=%d path=%d loaded=%d',
        runId.slice(0, 8),
        (detail.runs ?? []).length,
        path.length,
        loaded.length,
      );
    } catch (err) {
      Logger.warn('[useWorkstationState] failed to switch branch to %s', runId, err);
    }
  }, []);

  // Message handlers
  const attachmentIdsOf = useCallback((files: AttachedFile[]): string[] | undefined => {
    const ids = files.map((f) => f.attachmentId).filter((x): x is string => !!x);
    return ids.length > 0 ? ids : undefined;
  }, []);

  const { handleSendMessage, handleHomeSend } = useMessageHandlers({
    conv, selectedAgentId, activeTeamId, activeTeamName,
    ensureModelPersisted, navigate, buildConvPath,
    runConvIdRef, pendingTempIdRef, teamMgmtTeams: teamMgmt.teams,
    notify, attachmentIdsOf,
  });

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
            if (team) void teamMgmt.linkMemberAgent(team.id, oldId, created.id);
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

  const displayMessages: Message[] = useMemo(
    () =>
      apiMessages.map((m) => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'agent',
        agentId: m.role,
        content: m.content,
        thinking: m.thinking,
        thinkingDone: m.thinkingDone === true,
        timestamp: m.created_at ? new Date(m.created_at).getTime() : 0,
        versions: m.versions,
        currentVersion: m.currentVersion,
        userVersions: m.userVersions,
        currentUserVersion: m.currentUserVersion,
        answerVersions: m.answerVersions,
        currentAnswerVersion: m.currentAnswerVersion,
        thumbsFeedback: m.thumbsFeedback,
        interrupted: m.interrupted,
        attachments: m.attachments,
      })),
    [apiMessages],
  );

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
    toast, t, notify, teamMgmt, conv, apiCommands, models, agentCommands,
    apiMessages, apiStatus, apiError, wsStatus, submitToApi, resetApi,
    cancelRun, retryApi, loadConversation, abandonedRunId, selectedAgentId,
    setSelectedAgentId, configuringAgent, setConfiguringAgent,
    isUserMenuOpen, setIsUserMenuOpen, isSettingsOpen, setIsSettingsOpen,
    isApiOpen, setIsApiOpen, isSidebarOpen, setIsSidebarOpen,
    welcomeDismissed, setWelcomeDismissed, isNewProjectOpen, setIsNewProjectOpen,
    confirmDialog, setConfirmDialog, conversationKey, setConversationKey,
    isWorkspaceOpen, setIsWorkspaceOpen, activeWorkspaceTab, setActiveWorkspaceTab,
    selectedModel, setSelectedModel, isWorkstationOpen, setIsWorkstationOpen,
    settings, updateSettings, isDarkMode, activeTeamId, activeTeamName,
    showAgentChat, activeConvId, navigateToConversation, filteredConversations,
    effectiveSelectedModel,
    hasMessages: hasMessages || restoring || activeConvId !== null,
    isPageDragOver, handlePageDragOver, handlePageDragLeave, handlePageDrop,
    toggleWorkspaceFullscreen, handleNewChat, handleSwitchBranch,
    syncActiveConversation, handleSendMessage, handleHomeSend,
    handleSaveAgent, handleExecuteCommand, handleCloseAgentConfig,
    handleCloseSettings, handleCloseApi, handleCloseConfirm, handleCloseNewProject,
    displayMessages, allCommands, allAgents,
  };
}
