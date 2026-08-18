import { useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { getSessionDetail } from '../../api/client/sessions';
import { buildPathTurns } from '../../utils/branchTurns';
import { buildRunPath } from './workstationUtils';
import type { MutableRefObject } from 'react';
import type { useConversation } from '../../hooks/useConversation';

type ConversationReturn = ReturnType<typeof useConversation>;

interface ConvMessage {
  id: string | number;
  role: string;
  content: string;
  agentId?: string;
  thinking?: string;
  thinkingDone?: boolean;
  versions?: string[];
  currentVersion?: number;
  thumbsFeedback?: 'up' | 'down' | null;
  interrupted?: boolean;
  timestamp?: number;
  created_at?: string;
  userVersions?: string[];
  currentUserVersion?: number;
  thinkingVersions?: string[];
  versionRunIds?: string[];
}

export interface ConversationSyncDeps {
  conv: ConversationReturn;
  activeConvId: string | null;
  filteredConversations: ConversationReturn['conversations'];
  resetApi: () => void;
  loadConversation: (msgs: import('../../types').ChatMessage[], id: string, sessionId?: string) => void;
  setRestoring: (v: boolean) => void;
  setSelectedAgentId: (id: string | null) => void;
  activeTeamId?: string | null;
  activeTeamName?: string | null;
  apiStatus: string;
  urlTeamId?: string;
  urlAgentId?: string;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
}

export interface ConversationSyncResult {
  syncActiveConversation: (convId?: string) => void;
  suppressScrollRef: MutableRefObject<boolean>;
  followBottomRef: MutableRefObject<boolean>;
  skipReloadRef: MutableRefObject<boolean>;
  runConvIdRef: MutableRefObject<string | null>;
  pendingTempIdRef: MutableRefObject<string | null>;
  loadSeqRef: MutableRefObject<number>;
  buildConvPath: (conv: { id: string; kind?: string; teamId?: string | null; agentId?: string | null }) => string;
}

export function useConversationSync(deps: ConversationSyncDeps): ConversationSyncResult {
  const {
    conv, activeConvId, filteredConversations, resetApi,
    loadConversation, setRestoring, setSelectedAgentId,
    apiStatus, urlTeamId, urlAgentId,
    navigate,
  } = deps;

  const convRef = useRef(conv);
  useEffect(() => { convRef.current = conv; });

  const runConvIdRef = useRef<string | null>(null);
  const skipReloadRef = useRef(false);
  const pendingTempIdRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const suppressScrollRef = useRef(false);
  const followBottomRef = useRef(true);

  const syncActiveConversation = useCallback((convId?: string) => {
    const targetId = convId ?? convRef.current.activeConvId;
    if (!targetId) return;
    const state = useChatStore.getState();
    if (state.messages.length > 0) {
      // 用目标会话自身的团队归属写回，不用全局 activeTeamId：
      // 从团队会话切到 agent/normal 会话时 activeTeam 残留会导致
      // agent 会话被错写 teamId/teamName（副标题错乱 + localStorage 污染）。
      const targetConv = convRef.current.conversations.find(
        (c) => c.id === targetId || c.sessionId === targetId,
      );
      const teamId = targetConv?.teamId ?? undefined;
      const teamName = targetConv?.teamName ?? undefined;
      convRef.current.updateConversationMessages(targetId, state.messages, false, teamId, teamName);
    }
    if (state.currentSessionId) {
      convRef.current.confirmConversationSession(targetId, state.currentSessionId);
    }
    runConvIdRef.current = null;
  }, []);

  const buildConvPath = useCallback((conv: {
    id: string; kind?: string; teamId?: string | null; agentId?: string | null;
  }) => {
    if (conv.kind === 'team' && conv.teamId) return `/team/${conv.teamId}/${conv.id}`;
    if (conv.kind === 'agent' && conv.agentId) return `/agent/${conv.agentId}/${conv.id}`;
    return `/chat/${conv.id}`;
  }, []);

  // URL restore effect: load conversation from URL
  useEffect(() => {
    const activeId = activeConvId;
    if (skipReloadRef.current) {
      skipReloadRef.current = false;
      return;
    }
    if (activeId && activeId !== conv.activeConvId) {
      conv.setActiveConvId(activeId);
    }
    if (!activeId) {
      useChatStore.getState().reset();
      return;
    }
    const timer = setTimeout(() => {
      const tempFound = filteredConversations.find((c: { id: string; temp?: boolean }) => c.id === activeId && c.temp);
      if (tempFound) {
        setRestoring(false);
        return;
      }
      setRestoring(true);
      followBottomRef.current = true;
      useChatStore.getState().clearMessages(activeId);
      const found = filteredConversations.find((c: { id: string }) => c.id === activeId);
      if (!found) { resetApi(); setRestoring(false); return; }

      const loadSnapshot = () => {
        const chatMessages = (found.messages as ConvMessage[]).map((m: ConvMessage, idx: number) => ({
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
            const live = current.find((c: { content: string; role: string; thinking?: string }) => c.content === msg.content && c.role === msg.role);
            if (live?.thinking) msg.thinking = live.thinking;
          }
          if (!msg.versions) {
            const live = current.find((c: { content: string; role: string; versions?: unknown; currentVersion?: unknown }) => c.content === msg.content && c.role === msg.role);
            if (live?.versions) { msg.versions = live.versions; msg.currentVersion = live.currentVersion; }
          }
          if (!msg.thumbsFeedback) {
            const live = current.find((c: { content: string; role: string; thumbsFeedback?: unknown }) => c.content === msg.content && c.role === msg.role);
            if (live?.thumbsFeedback) msg.thumbsFeedback = live.thumbsFeedback;
          }
          if (!msg.thinkingDone) {
            const live = current.find((c: { content: string; role: string; thinkingDone?: boolean }) => c.content === msg.content && c.role === msg.role);
            if (live?.thinkingDone) msg.thinkingDone = true;
          }
        }
        loadConversation(chatMessages, found.id, found.sessionId);
      };

      if (found.sessionId) {
        let cancelled = false;
        if (found.messages.length > 0) {
          loadSnapshot();
        } else {
          resetApi();
        }
        getSessionDetail(found.sessionId).then((detail) => {
          if (cancelled) return;
          const runs = detail.runs ?? [];
          const branchKey = `agentstudio-branch:${found.sessionId}`;
          let storedRunId: string | null = null;
          try { storedRunId = localStorage.getItem(branchKey); } catch { /* non-fatal */ }
          const fromRunId =
            storedRunId && runs.some((r: { id: string }) => r.id === storedRunId)
              ? storedRunId
              : null;
          const { path, active } = buildRunPath(runs, fromRunId);
          const loaded = buildPathTurns(path, runs);
          for (const m of loaded) {
            if (m.role !== 'user' && m.thinkingDone === undefined) {
              m.thinkingDone = true;
            }
            const raw = m as unknown as Record<string, unknown>;
            const thinkingVersions = raw.thinking_versions as string[] | undefined;
            if (thinkingVersions && thinkingVersions.length > 0) {
              m.thinkingVersions = thinkingVersions;
            }
          }
          if (loaded.length > 0) {
            const snapshot = (found.messages || []) as ConvMessage[];
            for (const m of loaded) {
              const local = snapshot.find((lm: ConvMessage) => lm.content === m.content && (lm.role === 'user') === (m.role === 'user'));
              if (!local) continue;
              m.versions = local.versions ?? m.versions;
              m.thinkingVersions = local.thinkingVersions ?? m.thinkingVersions;
              m.userVersions = m.userVersions ?? local.userVersions;
              m.currentVersion = local.currentVersion ?? m.currentVersion;
              m.currentUserVersion = local.currentUserVersion ?? m.currentUserVersion;
              m.thumbsFeedback = local.thumbsFeedback ?? undefined;
              m.interrupted = local.interrupted ?? undefined;
              m.thinkingDone = local.thinkingDone === true || Boolean(m.thinking && !m.interrupted);
            }
            conv.updateConversationMessages(activeId, loaded as unknown as import('../../types/AgentStudio').Message[], false);
            loadConversation(loaded, found.id, found.sessionId);
            useChatStore.setState({ currentRunId: active, activeRunId: active });
            setRestoring(false);
          } else if (found.messages.length > 0) {
            loadSnapshot();
            setRestoring(false);
          } else {
            resetApi();
            setRestoring(false);
          }
        }).catch(() => {
          if (found.messages.length > 0) loadSnapshot();
          else resetApi();
          setRestoring(false);
        });
        return () => { cancelled = true; };
      }

      if (found.messages.length === 0) { resetApi(); setRestoring(false); return; }
      loadSnapshot();
      setRestoring(false);
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, conv.sessionsLoaded]);

  // Invalid session redirect
  useEffect(() => {
    if (!activeConvId || !conv.sessionsLoaded) return;
    if (
      activeConvId.startsWith('temp-') &&
      (filteredConversations.some((c: { id: string }) => c.id === activeConvId) ||
        apiStatus === 'loading' ||
        apiStatus === 'running')
    ) {
      return;
    }
    const exists = filteredConversations.some(
      (c: { id: string; sessionId?: string }) => c.id === activeConvId || c.sessionId === activeConvId,
    );
    if (!exists) {
      if (urlTeamId) navigate(`/team/${urlTeamId}`);
      else if (urlAgentId) navigate(`/agent/${urlAgentId}`);
      else navigate('/');
    }
  }, [activeConvId, filteredConversations, conv.sessionsLoaded, navigate, apiStatus, urlTeamId, urlAgentId]);

  // URL identity sync
  useEffect(() => {
    if (urlTeamId) useChatStore.getState().setActiveTeam(urlTeamId);
    if (!urlAgentId) return;
    const timer = setTimeout(() => setSelectedAgentId(urlAgentId), 0);
    return () => clearTimeout(timer);
  }, [urlTeamId, urlAgentId, setSelectedAgentId]);

  // Kind restore for old links
  useEffect(() => {
    if (!activeConvId) return;
    const timer = setTimeout(() => {
      const target = filteredConversations.find((c: { id: string; kind?: string; teamId?: string; agentId?: string }) => c.id === activeConvId);
      if (!target) return;
      const teamId = target.kind === 'team' ? target.teamId : undefined;
      const agentId = target.kind === 'agent' ? target.agentId : undefined;
      useChatStore.getState().setActiveTeam(teamId ?? null);
      setSelectedAgentId(agentId ?? null);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeConvId, filteredConversations, setSelectedAgentId]);

  return {
    syncActiveConversation,
    suppressScrollRef,
    followBottomRef,
    skipReloadRef,
    runConvIdRef,
    pendingTempIdRef,
    loadSeqRef,
    buildConvPath,
  };
}
