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
import { getSessionDetail } from '../../api/client/sessions';
import { useDragAndDrop } from './useDragAndDrop';
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
  const [selectedModel, setSelectedModelState] = useState(() => {
    try {
      return localStorage.getItem('agentstudio-selected-model') || '';
    } catch {
      return '';
    }
  });
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
    () => (selectedModel && models.some((m) => m.id === selectedModel) ? selectedModel : (models.length > 0 ? models[0].id : '')),
    [selectedModel, models],
  );
  // Persist the selected model so chatActions can route the request to the
  // key whose models contain it (a SiliconFlow model must hit SiliconFlow).
  const setSelectedModel = useCallback((id: string) => {
    setSelectedModelState(id);
    try {
      localStorage.setItem('agentstudio-selected-model', id);
    } catch {
      // localStorage unavailable — routing falls back to the default key
    }
  }, []);
  const hasMessages = apiMessages.length > 0;
  const convRef = useRef(conv);
  useEffect(() => {
    convRef.current = conv;
  });
  // Conversation that owns the currently running run — sync must write back to
  // it even if the user switches away mid-run, never to the newly active one.
  const runConvIdRef = useRef<string | null>(null);

  // Persist in-flight store messages into a conversation. Must run BEFORE a
  // switch takes effect (while the store still holds the old run's messages).
  const syncActiveConversation = useCallback((convId?: string) => {
    const targetId = convId ?? convRef.current.activeConvId;
    if (!targetId) return;
    const state = useChatStore.getState();
    if (state.messages.length > 0) {
      convRef.current.updateConversationMessages(targetId, state.messages, false, activeTeamId ?? undefined, activeTeamName);
    }
    if (state.currentSessionId) {
      convRef.current.updateConversationSessionId(targetId, state.currentSessionId, false);
    }
    runConvIdRef.current = null;
  }, [activeTeamId, activeTeamName, convRef]);

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

  // Sync messages back to conversation when run completes (status idle)
  // OR when WebSocket disconnects — covers the case where the 'result'
  // event is lost and apiStatus stays at 'running'.
  useEffect(() => {
    if (apiStatus === 'loading') return;
    if (apiStatus === 'running' && wsStatus !== 'disconnected') return;

    syncActiveConversation(runConvIdRef.current ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiMessages, apiStatus, wsStatus, syncActiveConversation]);

  useEffect(() => {
    const activeId = conv.activeConvId;
    if (!activeId) return;
    const found = filteredConversations.find((c) => c.id === activeId);
    if (!found) { resetApi(); return; }

    const loadSnapshot = () => {
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
    };

    // Backend is the source of truth for session-backed conversations: always
    // re-fetch so fresh data (thinking included) wins over stale localStorage
    // snapshots. Local-only UI state (versions/thumbs/interrupted) is overlaid
    // from the snapshot; on API failure/empty, fall back to the snapshot.
    if (found.sessionId) {
      let cancelled = false;
      getSessionDetail(found.sessionId).then((detail) => {
        if (cancelled) return;
        const msgs: import('../../types').ChatMessage[] = [];
        if (detail.runs) {
          for (const run of detail.runs) {
            // Use run.messages with thinking if available (from batch message loading)
            if (run.messages && run.messages.length > 0) {
              for (const m of run.messages) {
                msgs.push({
                  id: m.id || `run-${run.id}-${m.round_number}-${m.role}`,
                  role: m.role === 'user' ? 'user' : 'assistant',
                  agent_name: m.agent_name || (m.role === 'user' ? '我' : found.teamName || 'Agent'),
                  content: m.content,
                  thinking: m.thinking ?? undefined,
                  round_number: m.round_number ?? 0,
                  created_at: m.created_at || null,
                  versions: m.versions,
                  thinkingVersions: (m as unknown as Record<string, unknown>).thinking_versions as string[] | undefined,
                  userVersions: (m as unknown as Record<string, unknown>).user_versions as string[] | undefined,
                  currentVersion: m.versions && m.versions.length > 0 ? m.versions.length - 1 : undefined,
                  currentUserVersion: (m as unknown as Record<string, unknown>).user_versions ? ((m as unknown as Record<string, unknown>).user_versions as string[]).length - 1 : undefined,
                });
              }
            } else {
              // Fallback: construct from run.requirement / run.code
              msgs.push({
                id: `run-${run.id}-user`,
                role: 'user',
                agent_name: '我',
                content: run.requirement,
                round_number: 0,
                created_at: run.created_at || null,
              });
              if (run.code) {
                msgs.push({
                  id: `run-${run.id}-agent`,
                  role: 'assistant',
                  agent_name: found.teamName || 'Agent',
                  content: run.code,
                  round_number: 0,
                  created_at: run.updated_at || run.created_at || null,
                });
              }
            }
          }
        }
        if (msgs.length > 0) {
          const snapshot = found.messages || [];
          for (const m of msgs) {
            const local = snapshot.find((lm) => lm.content === m.content && (lm.role === 'user') === (m.role === 'user'));
            if (!local) continue;
            // Server-persisted versions win; the local snapshot only fills gaps
            // (thumbs/interrupted are UI-only and never persisted server-side).
            m.versions = local.versions ?? m.versions;
            m.thinkingVersions = local.thinkingVersions ?? m.thinkingVersions;
            m.userVersions = local.userVersions ?? m.userVersions;
            m.currentVersion = local.currentVersion ?? m.currentVersion;
            m.currentUserVersion = local.currentUserVersion ?? m.currentUserVersion;
            m.thumbsFeedback = local.thumbsFeedback ?? undefined;
            m.interrupted = local.interrupted ?? undefined;
            m.thinkingDone = local.thinkingDone === true || Boolean(m.thinking && !m.interrupted);
          }
          conv.updateConversationMessages(activeId, msgs as unknown as import('../../types/AgentStudio').Message[], false);
          loadConversation(msgs, found.id, found.sessionId);
        } else if (found.messages.length > 0) {
          loadSnapshot();
        } else {
          resetApi();
        }
      }).catch(() => {
        if (found.messages.length > 0) loadSnapshot();
        else resetApi();
      });
      return () => { cancelled = true; };
    }

    if (found.messages.length === 0) { resetApi(); return; }
    loadSnapshot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.activeConvId]);

  const handleNewChat = useCallback(() => {
    syncActiveConversation();
    resetApi();
    setSelectedAgentId(null);
    conv.setActiveConvId(null);
    setConversationKey((prev) => prev + 1);
  }, [syncActiveConversation, conv, resetApi]);

  const handleSendMessage = useCallback(
    (text: string, _files: AttachedFile[]) => {
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      if (!conv.activeConvId) {
        const tName = teamMgmt.teams.find(t => t.id === activeTeamId)?.name;
        const kind: 'agent' | 'team' | 'normal' = selectedAgentId ? 'agent' : activeTeamId ? 'team' : 'normal';
        const convId = conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined, activeTeamId ?? undefined, tName, kind);
        if (convId) { conv.setActiveConvId(convId); runConvIdRef.current = convId; }
      } else {
        runConvIdRef.current = conv.activeConvId;
        // 续聊：把用户消息追加到当前会话，避免历史里只剩第一条用户消息
        const activeConv = conv.conversations.find((c) => c.id === conv.activeConvId);
        const prevMessages = activeConv?.messages ?? [];
        conv.updateConversationMessages(conv.activeConvId, [...prevMessages, userMessage], true, activeTeamId ?? undefined, activeTeamName);
        const st = useChatStore.getState();
        useChatStore.setState({ messages: [...st.messages, {
          id: userMessage.id, role: userMessage.role, agent_name: '我',
          content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
        }] });
      }
      window.dispatchEvent(new CustomEvent('clear-browser-url'));
      submitToApi(text, undefined, selectedAgentId ?? undefined, true).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [submitToApi, selectedAgentId, notify, conv, activeTeamId, activeTeamName, teamMgmt.teams],
  );

  const handleHomeSend = useCallback(
    (text: string, _files: AttachedFile[]) => {
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      const homeKind: 'agent' | 'team' | 'normal' = selectedAgentId ? 'agent' : 'normal';
      if (!conv.activeConvId) {
        const convId = conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined, undefined, undefined, homeKind);
        if (convId) { conv.setActiveConvId(convId); runConvIdRef.current = convId; }
      } else {
        runConvIdRef.current = conv.activeConvId;
        const activeConv = conv.conversations.find((c) => c.id === conv.activeConvId);
        const prevMessages = activeConv?.messages ?? [];
        conv.updateConversationMessages(conv.activeConvId, [...prevMessages, userMessage], true);
        const st = useChatStore.getState();
        useChatStore.setState({ messages: [...st.messages, {
          id: userMessage.id, role: userMessage.role, agent_name: '我',
          content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
        }] });
      }
      // saveConversation + setActiveConvId → useEffect loads msg into store → skip duplicate
      submitToApi(text, undefined, undefined, true).catch(() => {
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
    userVersions: m.userVersions,
    currentUserVersion: m.currentUserVersion,
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
    syncActiveConversation,
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
