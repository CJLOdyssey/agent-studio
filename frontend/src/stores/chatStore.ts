import { create } from 'zustand';
import type { AgentConfig, AppStatus, ChatMessage, RunResult } from '../types';
import { connectRun, disconnectRun } from '../api/websocket';
import { submitRequirement as submitRequirementExternal, resumeRun, listAgents, listKeys } from '../api/client';
import Logger from '../utils/logger';
import { uid } from './uid';
import type { ChatState } from './chatTypes';
import { createStreamHandler } from './chatStreaming';

export type { WsConnectionStatus, ChatState } from './chatTypes';

const INITIAL_STATE = {
  currentRunId: null,
  currentSessionId: null,
  currentConvId: null,
  messages: [],
  status: 'idle' as AppStatus,
  result: null,
  currentRole: null,
  error: null,
  streamingId: null,
  lastAbandonedRunId: null,
  interruptedMessageId: null,
  continuingId: null,
  skipThinking: false,
  pendingVersions: null,
  pendingThinkingVersions: null,
  agents: [] as AgentConfig[],
  agentsLoaded: false,
  wsStatus: 'disconnected' as ChatState['wsStatus'],
  submissionConvId: null,
  activeTeamId: null,
  selectedAgentId: null as string | null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  ...INITIAL_STATE,

  restoreSession: (sessionId: string, runId: string, messages: ChatMessage[], result: RunResult | null, status: AppStatus) => {
    set({ currentSessionId: sessionId, currentRunId: runId, messages, result, status, error: null, currentRole: messages.length > 0 ? messages[messages.length - 1].role : null });
  },

  loadConversation: (messages: ChatMessage[], convId?: string | null, sessionId?: string | null) => {
    const s = get();
    const prevRunId = s.currentRunId;
    if (prevRunId) {
      Logger.info('[chat] loadConversation — disconnecting previous run %s', prevRunId);
      disconnectRun(prevRunId);
    }
    set({ messages, currentConvId: convId ?? null, currentSessionId: sessionId ?? null, currentRunId: null, streamingId: null, status: 'idle', wsStatus: 'disconnected', lastAbandonedRunId: prevRunId, error: null, skipThinking: false, continuingId: null, interruptedMessageId: null, submissionConvId: null });
  },

  cancelRun: () => {
    const s = get();
    const prevRunId = s.currentRunId;
    const sid = s.streamingId;
    if (prevRunId) {
      Logger.info('[chat] cancelRun — disconnecting run %s', prevRunId);
      disconnectRun(prevRunId);
    }
    set({ currentRunId: null, streamingId: null, status: 'idle', wsStatus: 'disconnected', interruptedMessageId: sid, continuingId: null, skipThinking: false });
  },

  submitRequirement: async (requirement: string, session_id?: string, agent_id?: string, skipAddUserMessage?: boolean, submissionConvId?: string | null) => {
    const s = get();
    const effectiveSessionId = session_id || s.currentSessionId || undefined;
    if (s.currentRunId) {
      disconnectRun(s.currentRunId);
    }
    // 记录提交时的对话 ID，sync effect 用这个保存消息到正确的对话
    set({ submissionConvId: submissionConvId ?? null });

    let keyId: string | undefined;
    let model: string | undefined;
    try {
      const keys = await listKeys();
      const defaultKey = keys.find((k) => k.is_default && k.is_active) || keys.find((k) => k.is_active);
      if (defaultKey) {
        keyId = defaultKey.id;
        const persistedModel = localStorage.getItem('devagents-selected-model');
        model = (persistedModel && defaultKey.models.includes(persistedModel))
          ? persistedModel
          : defaultKey.models[0];
      }
    } catch {
      // Key vault unavailable
    }

    if (!keyId) {
      set({ status: 'error', error: '请先在设置中配置 API Key', wsStatus: 'disconnected' });
      return;
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      agent_name: '我',
      content: requirement,
      round_number: 0,
      created_at: new Date().toISOString(),
    };

    set({
      status: 'loading',
      error: null,
      result: null,
      messages: skipAddUserMessage ? get().messages : [...get().messages, userMsg],
      currentRole: null,
    });

    try {
      const teamId = get().activeTeamId ?? undefined;
      Logger.info('[chat] submitRequirement — team_id=%s | agent_id=%s | session_id=%s', teamId, agent_id, effectiveSessionId);
      const resp = await submitRequirementExternal(requirement, effectiveSessionId, keyId, model, agent_id, teamId);
      const run_id = resp.run_id;
      const returnedSessionId = resp.session_id || effectiveSessionId || null;
      set({ currentRunId: run_id, currentSessionId: returnedSessionId, status: 'running', wsStatus: 'connecting' });
      connectRun(run_id, { onMessage: createStreamHandler(set, get) });
    } catch (err: any) {
      Logger.error('[chat] submitRequirement failed:', err);
      set({ status: 'error', error: err?.message || String(err) });
    }
  },

  editMessage: async (msgIndex: number, newContent: string) => {
    set((s) => {
      const updated = [...s.messages];
      const msg = { ...updated[msgIndex], content: newContent };
      updated[msgIndex] = msg;
      return { messages: updated };
    });
  },

  regenerateMessage: async (msgIndex: number) => {
    const s = get();
    if (msgIndex < 1) return;
    const userMsg = s.messages[msgIndex - 1];
    if (!userMsg) return;
    if (s.currentRunId) disconnectRun(s.currentRunId);
    set({ status: 'loading', error: null, result: null, messages: s.messages.slice(0, msgIndex) });
    await get().submitRequirement(userMsg.content, s.currentSessionId ?? undefined, undefined, true);
  },

  retry: async () => {
    const s = get();
    set({ status: 'loading', error: null, result: null });
    if (s.currentRunId) {
      disconnectRun(s.currentRunId);
    }
    const lastUserMsg = [...s.messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) {
      set({ status: 'error', error: '没有找到用户消息，无法重试' });
      return;
    }
    set({ currentRunId: null });
    try {
      const resp = await submitRequirementExternal(lastUserMsg.content, s.currentSessionId ?? undefined);
      set({ currentRunId: resp.run_id, currentSessionId: resp.session_id || s.currentSessionId || null, status: 'running', wsStatus: 'connecting' });
      connectRun(resp.run_id, { onMessage: createStreamHandler(set, get) });
    } catch (err: any) {
      Logger.error('[chat] retry failed:', err);
      set({ status: 'error', error: err?.message || String(err) });
    }
  },

  continueGeneration: async () => {
    const s = get();
    const intId = s.interruptedMessageId;
    if (!intId) return;
    const idx = s.messages.findIndex((m) => m.id === intId);
    if (idx < 0) {
      set({ interruptedMessageId: null });
      return;
    }
    Logger.info('[chat] continueGeneration — continuing from interrupted msg %s', intId);
    const interruptedMsg = s.messages[idx];
    set({ continuingId: intId, skipThinking: false, pendingVersions: interruptedMsg.versions || [interruptedMsg.content], pendingThinkingVersions: interruptedMsg.thinkingVersions?.length ? interruptedMsg.thinkingVersions : (interruptedMsg.thinking ? [interruptedMsg.thinking] : null) });
    const continuation = interruptedMsg.content;
    const prevRunId = s.currentRunId;
    if (prevRunId) disconnectRun(prevRunId);
    set({ status: 'loading', error: null, result: null });
    try {
      const resp = await resumeRun(continuation, s.currentSessionId || undefined, interruptedMsg.thinking);
      const run_id = resp.run_id;
      const returnedSessionId = resp.session_id || s.currentSessionId || null;
      set({ currentRunId: run_id, currentSessionId: returnedSessionId, status: 'running', wsStatus: 'connecting' });
      connectRun(run_id, { onMessage: createStreamHandler(set, get) });
    } catch (err: any) {
      Logger.error('[chat] continueGeneration failed:', err);
      set({ status: 'error', error: err?.message || String(err) });
    }
  },

  addMessage: (msg) => {
    set((s) => ({ messages: [...s.messages, { id: msg.id || uid(), role: msg.role!, agent_name: msg.agent_name || 'Agent', content: msg.content || '', thinking: msg.thinking, round_number: msg.round_number ?? 0, created_at: new Date().toISOString() }], currentRole: msg.role! || 'Agent' }));
  },

  setResult: (result) => set({ result }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setWsStatus: (wsStatus) => set({ wsStatus }),

  reset: () => {
    const s = get();
    if (s.currentRunId) disconnectRun(s.currentRunId);
    const activeTeamId = s.activeTeamId;
    set({ ...INITIAL_STATE, activeTeamId, submissionConvId: null });
  },

  switchVersion: (msgId, direction) => {
    set((s) => ({ messages: s.messages.map((m) => {
      if (m.id !== msgId || !m.versions) return m;
      const max = m.versions.length - 1;
      const cv = m.currentVersion ?? max;
      const nv = direction === 'prev' ? Math.max(0, cv - 1) : Math.min(max, cv + 1);
      return { ...m, currentVersion: nv, content: m.versions[nv], thinking: m.thinkingVersions?.[nv] ?? m.thinking ?? '' };
    }) }));
  },

  setThumbsFeedback: (msgId, value) => {
    set((s) => ({ messages: s.messages.map((m) => m.id === msgId ? { ...m, thumbs: value } : m) }));
  },

  loadAgents: async () => {
    try {
      set({ agentsLoaded: false });
      const agents = await listAgents();
      set({ agents, agentsLoaded: true });
    } catch (err) {
      Logger.error('[chat] loadAgents failed:', err);
      set({ agentsLoaded: true });
    }
  },

  selectAgent: (_agentId) => {
    set({ selectedAgentId: _agentId });
  },

  setActiveTeam: (teamId) => {
    set({ activeTeamId: teamId });
  },
}));