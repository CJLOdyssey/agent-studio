import { create } from 'zustand';
import type { AgentConfig, AppStatus, ChatMessage, RunResult, WsMessage } from '../types';
import { connectRun, disconnectRun } from '../api/websocket';
import { submitRequirement, listAgents, listKeys } from '../api/client';
import Logger from '../utils/logger';

const uid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface ChatState {
  currentRunId: string | null;
  currentSessionId: string | null;
  currentConvId: string | null;
  messages: ChatMessage[];
  status: AppStatus;
  result: RunResult | null;
  currentRole: string | null;
  error: string | null;
  streamingId: string | null;
  /** Set after a conversation switch disconnects an active run. Cleared on next loadConversation. */
  lastAbandonedRunId: string | null;
  /** Set when user cancels an active streaming run. Cleared on new submit or continue. */
  interruptedMessageId: string | null;
  /** Set when user clicks "继续生成". Cleared when streaming replaces the message. */
  continuingId: string | null;
  /** When true, ignore thinking_stream chunks (continuation mode — preserve old thinking). */
  skipThinking: boolean;
  /** Pending versions for the next agent message to be created */
  pendingVersions: string[] | null;
  switchVersion: (msgId: string, direction: 'prev' | 'next') => void;
  setThumbsFeedback: (msgId: string, value: 'up' | 'down' | null) => void;

  /**
   * @deprecated Use `useAgents()` from `@/api/hooks` (React Query) as the single source of truth.
   * Kept for backward compatibility with legacy components (MessageBubble, ConfigPanel).
   * Will be removed once all consumers migrate to React Query.
   */
  agents: AgentConfig[];
  /** @deprecated Use `useAgents().isSuccess` instead. */
  agentsLoaded: boolean;

  wsStatus: WsConnectionStatus;

  submitRequirement: (requirement: string, session_id?: string, agent_id?: string, skipAddUserMessage?: boolean) => Promise<void>;
  editMessage: (msgIndex: number, newContent: string) => Promise<void>;
  regenerateMessage: (msgIndex: number) => Promise<void>;
  retry: () => Promise<void>;
  restoreSession: (
    sessionId: string,
    runId: string,
    messages: ChatMessage[],
    result: RunResult | null,
    status: AppStatus,
  ) => void;
  loadConversation: (messages: ChatMessage[], convId?: string | null, sessionId?: string | null) => void;
  cancelRun: () => void;
  continueGeneration: () => Promise<void>;
  addMessage: (msg: WsMessage) => void;
  setStatus: (status: AppStatus) => void;
  setResult: (result: RunResult) => void;
  setError: (error: string | null) => void;
  setWsStatus: (wsStatus: WsConnectionStatus) => void;
  reset: () => void;

  /** @deprecated Use `prefetchAgents(queryClient)` from `@/api/hooks` instead. */
  loadAgents: () => Promise<void>;
  selectAgent: (agentId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentRunId: null,
  currentSessionId: null,
  currentConvId: null,
  messages: [],
  status: 'idle',
  result: null,
  currentRole: null,
  error: null,
  streamingId: null,
  lastAbandonedRunId: null,
  interruptedMessageId: null,
  continuingId: null,
  skipThinking: false,
  pendingVersions: null,
  agents: [],
  agentsLoaded: false,
  wsStatus: 'disconnected',

  restoreSession: (
    sessionId: string,
    runId: string,
    messages: ChatMessage[],
    result: RunResult | null,
    status: AppStatus,
  ) => {
    set({
      currentSessionId: sessionId,
      currentRunId: runId,
      messages,
      result,
      status,
      error: null,
      currentRole: messages.length > 0 ? messages[messages.length - 1].role : null,
    });
  },

  cancelRun: () => {
    const state = get();
    const prevRunId = state.currentRunId;
    const sid = state.streamingId;
    if (prevRunId) {
      Logger.info(`[chat] cancelRun — disconnecting run ${prevRunId}`);
      disconnectRun(prevRunId);
    }
    set({
      currentRunId: null,
      streamingId: null,
      status: 'idle',
      wsStatus: 'disconnected',
      interruptedMessageId: sid,
      continuingId: null,
      skipThinking: false,
    });
  },

  continueGeneration: async () => {
    const state = get();
    const intId = state.interruptedMessageId;
    if (!intId) return;

    const idx = state.messages.findIndex((m) => m.id === intId);
    if (idx < 0) {
      set({ interruptedMessageId: null });
      return;
    }

    Logger.info(`[chat] continueGeneration — continuing from interrupted msg ${intId}`);

    const interruptedMsg = state.messages[idx];

    // Don't trim — continuingId replacement in thinking_stream handles message swap
    set({
      continuingId: intId,
      skipThinking: true,
      pendingVersions: interruptedMsg.versions || [interruptedMsg.content],
    });

    // skipAddUserMessage=true keeps the user's original message unchanged in chat
    const continuation = `继续写以下内容：\n${interruptedMsg.content}`;
    await get().submitRequirement(continuation, state.currentSessionId || undefined, undefined, true);
  },

  setThumbsFeedback: (msgId: string, value: 'up' | 'down' | null) => {
    const state = get();
    const updated = state.messages.map((m) =>
      m.id === msgId ? { ...m, thumbsFeedback: value === null ? undefined : value } : m,
    );
    set({ messages: updated });
  },

  switchVersion: (msgId: string, direction: 'prev' | 'next') => {
    const state = get();
    const msgIndex = state.messages.findIndex((m) => m.id === msgId);
    if (msgIndex < 0) return;
    const msg = state.messages[msgIndex];
    if (msg.role !== 'agent') return;
    const versions = msg.versions || [msg.content];
    const currentIdx = msg.currentVersion ?? 0;
    let newIdx = currentIdx;
    if (direction === 'prev' && currentIdx > 0) newIdx = currentIdx - 1;
    if (direction === 'next' && currentIdx < versions.length - 1) newIdx = currentIdx + 1;
    if (newIdx === currentIdx) return;
    const updated = state.messages.map((m) =>
      m.id === msgId ? { ...m, currentVersion: newIdx, content: versions[newIdx] } : m,
    );
    set({ messages: updated });
  },

  loadConversation: (messages: ChatMessage[], convId?: string | null, sessionId?: string | null) => {
    const prevRunId = get().currentRunId;
    let abandoned: string | null = null;
    if (prevRunId) {
      Logger.info(`[chat] switching conversation, disconnecting run ${prevRunId}`);
      disconnectRun(prevRunId);
      abandoned = prevRunId;
    }
    set({
      messages,
      currentConvId: convId ?? null,
      currentSessionId: sessionId ?? null,
      lastAbandonedRunId: abandoned,
      status: 'idle',
      error: null,
      currentRole: messages.length > 0 ? messages[messages.length - 1].role : null,
      currentRunId: null,
      interruptedMessageId: null,
      continuingId: null,
      skipThinking: false,
      wsStatus: 'disconnected',
    });
  },

  editMessage: async (msgIndex: number, newContent: string) => {
    const state = get();
    const msgs = state.messages;
    if (msgIndex < 0 || msgIndex >= msgs.length) return;

    if (state.currentRunId) {
      disconnectRun(state.currentRunId);
    }

    const updated = msgs.slice(0, msgIndex + 1);
    updated[msgIndex] = { ...updated[msgIndex], content: newContent };

    set({
      messages: updated,
      currentRunId: null,
      streamingId: null,
      status: 'idle',
      error: null,
      result: null,
    });

    // skipAddUserMessage=true because the edited message is already in the array
    await get().submitRequirement(newContent, state.currentSessionId || undefined, undefined, true);
  },

  regenerateMessage: async (msgIndex: number) => {
    const state = get();
    const msgs = state.messages;
    if (msgIndex < 0 || msgIndex >= msgs.length) return;
    if (msgs[msgIndex].role !== 'agent') return;

    if (state.currentRunId) {
      disconnectRun(state.currentRunId);
    }

    // Find the last user message before this AI response
    let userMsgIndex = -1;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        userMsgIndex = i;
        break;
      }
    }
    if (userMsgIndex < 0) return;

    const agentMsg = msgs[msgIndex];
    const userContent = msgs[userMsgIndex].content;

    // Add current content to versions array
    const currentVersions = agentMsg.versions || [agentMsg.content];
    const newVersions = [...currentVersions];

    // Keep messages up to user message, then add a placeholder for the new version
    const updated = msgs.slice(0, userMsgIndex + 1);

    set({
      messages: updated,
      currentRunId: null,
      streamingId: null,
      status: 'idle',
      error: null,
      result: null,
    });

    // Store versions for later use when the new message arrives
    set({ pendingVersions: newVersions });

    // Re-submit the user message without adding a duplicate
    await get().submitRequirement(userContent, state.currentSessionId || undefined, undefined, true);
  },

  retry: async () => {
    const state = get();
    if (state.status !== 'error') return;
    const msgs = state.messages;
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const userContent = msgs[lastUserIdx].content;
    const updated = msgs.slice(0, lastUserIdx + 1);
    if (state.currentRunId) disconnectRun(state.currentRunId);
    set({
      messages: updated,
      currentRunId: null,
      streamingId: null,
      status: 'idle',
      error: null,
      result: null,
    });
    await get().submitRequirement(userContent, state.currentSessionId || undefined, undefined, true);
  },

  submitRequirement: async (requirement: string, session_id?: string, agent_id?: string, skipAddUserMessage?: boolean) => {
    set({ interruptedMessageId: null });
    const prevState = get();
    const prevRunId = prevState.currentRunId;
    if (prevRunId) {
      disconnectRun(prevRunId);
    }

    // Use stored session_id if not explicitly provided
    const effectiveSessionId = session_id || prevState.currentSessionId || undefined;

    // BYOK: resolve user's API key from the key vault
    let keyId: string | undefined;
    let model: string | undefined;
    try {
      const keys = await listKeys();
      const defaultKey = keys.find((k) => k.is_default && k.is_active) || keys.find((k) => k.is_active);
      if (defaultKey) {
        keyId = defaultKey.id;
        // Use persisted model selection if available, otherwise first from key
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
      id: crypto.randomUUID?.() || uid(),
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
      const resp = await submitRequirement(requirement, effectiveSessionId, keyId, model, agent_id);
      const run_id = resp.run_id;
      const returnedSessionId = resp.session_id || effectiveSessionId || null;
      set({ currentRunId: run_id, currentSessionId: returnedSessionId, status: 'running', wsStatus: 'connecting' });

      connectRun(run_id, {
        onMessage: (data) => {
          const msg = data as unknown as WsMessage;


          if (msg.type === 'stream') {
            const chunk = msg.content || '';
            if (!chunk) return;
            set((state) => {
              if (state.streamingId) {
                return {
  skipThinking: false,
                  messages: state.messages.map((m) => {
                    if (m.id !== state.streamingId) return m;
                    const updatedContent = m.content + chunk;
                    const versions = m.versions;
                    const cv = m.currentVersion ?? 0;
                    if (versions && versions[cv] !== undefined) {
                      const newVersions = [...versions];
                      newVersions[cv] = updatedContent;
                      return { ...m, content: updatedContent, thinking: m.thinking ?? '', versions: newVersions };
                    }
                    return { ...m, content: updatedContent, thinking: m.thinking ?? '' };
                  }),
                  currentRole: msg.agent_name || 'Agent',
                  wsStatus: 'connected' as WsConnectionStatus,
                };
              }
              const newId = crypto.randomUUID?.() || uid();
              const pending = state.pendingVersions;
              return {
                streamingId: newId,
                pendingVersions: null,
                skipThinking: false,
                messages: [
                  ...state.messages,
                  {
                    id: newId,
                    role: 'agent',
                    agent_name: msg.agent_name || 'Agent',
                    content: chunk,
                    thinking: '',
                    round_number: 0,
                    created_at: new Date().toISOString(),
                    versions: pending ? [...pending, chunk] : undefined,
                    currentVersion: pending ? pending.length : undefined,
                  },
                ],
                currentRole: msg.agent_name || 'Agent',
                wsStatus: 'connected' as WsConnectionStatus,
              };
            });
            return;
          }

          if (msg.type === 'message') {
            const m: ChatMessage = {
              id: crypto.randomUUID?.() || uid(),
              role: msg.role!,
              agent_name: msg.agent_name!,
              content: msg.content!,
              thinking: msg.thinking,
              round_number: msg.round_number ?? 0,
              created_at: new Date().toISOString(),
            };
            set((state) => ({
              messages: [...state.messages, m],
              currentRole: msg.role!,
              wsStatus: 'connected' as WsConnectionStatus,
            }));
            return;
          }

          if (msg.type === 'thinking_stream') {
            const chunk = msg.content || '';
            if (!chunk) {
              console.log('[chat] thinking_stream EMPTY CHUNK');
              return;
            }
            set((state) => {
              console.log('[chat] thinking_stream streamingId:', state.streamingId, 'skipThinking:', state.skipThinking, 'chunk:', chunk.substring(0, 30));
              if (state.streamingId) {
                // In continuation mode, preserve old thinking — skip new thinking chunks
                if (state.skipThinking) return {};
                return {
                  messages: state.messages.map((m) =>
                    m.id === state.streamingId
                      ? { ...m, thinking: (m.thinking ?? '') + chunk }
                      : m,
                  ),
                };
              }
              const newId = crypto.randomUUID?.() || uid();
              const pending = state.pendingVersions;
              const continuingId = state.continuingId;
              // If continuingId is set, replace old interrupted msg in-place (avoids duplicates)
              if (continuingId) {
                const contIdx = state.messages.findIndex((m) => m.id === continuingId);
                const oldMsg = contIdx >= 0 ? state.messages[contIdx] : null;
                const oldContent = oldMsg?.content || '';
                const oldThinking = oldMsg?.thinking || '';
                const base = contIdx >= 0 ? state.messages.slice(0, contIdx) : state.messages;
                const newVersions = pending ? [...pending] : undefined;
                if (newVersions && newVersions.length > 0) {
                  newVersions[newVersions.length - 1] = oldContent;
                }
                return {
                  streamingId: newId,
                  continuingId: null,
                  pendingVersions: null,
                  messages: [
                    ...base,
                    {
                      id: newId,
                      role: 'agent',
                      agent_name: oldMsg?.agent_name || msg.agent_name || 'Agent',
                      content: oldContent,
                      thinking: oldThinking,
                      round_number: 0,
                      created_at: new Date().toISOString(),
                      versions: newVersions,
                      currentVersion: newVersions ? newVersions.length - 1 : undefined,
                    },
                  ],
                  currentRole: msg.agent_name || 'Agent',
                  wsStatus: 'connected' as WsConnectionStatus,
                };
              }
              return {
                streamingId: newId,
                continuingId: null,
                pendingVersions: null,
                messages: [
                  ...state.messages,
                  {
                    id: newId,
                    role: 'agent',
                    agent_name: msg.agent_name || 'Agent',
                    content: '',
                    thinking: chunk,
                    round_number: 0,
                    created_at: new Date().toISOString(),
                    versions: pending ? [...pending, ''] : undefined,
                    currentVersion: pending ? pending.length : undefined,
                  },
                ],
                currentRole: msg.agent_name || 'Agent',
                wsStatus: 'connected' as WsConnectionStatus,
              };
            });
            return;
          }

          if (msg.type === 'thinking_done') {
            set((state) => {
              if (!state.streamingId) return state;
              // In continuation mode, don't replace old thinking with new
              if (state.skipThinking) return state;
              return {
                messages: state.messages.map((m) =>
                  m.id === state.streamingId
                    ? { ...m, thinking: msg.thinking ?? m.thinking, thinkingDone: true }
                    : m,
                ),
              };
            });
            return;
          }

          if (msg.type === 'status') {
            if (msg.status === 'error') {
              set({ status: 'error', error: msg.error ?? '未知错误' });
            }
            return;
          }

          if (msg.type === 'result') {
            const codeContent = msg.code ?? '';
            set((state) => {
              let msgs = state.messages;
              // Clean up pending thinking marker on the streaming message
              if (state.streamingId) {
                msgs = state.messages.map((m) => {
                  if (m.id !== state.streamingId) return m;
                  const updated: Partial<ChatMessage> = {};
                  if (codeContent) updated.content = codeContent;
                  if (m.thinking === '') updated.thinking = undefined;
                  if (m.thinking) updated.thinkingDone = true;
                  return Object.keys(updated).length ? { ...m, ...updated } : m;
                });
              } else if (codeContent) {
                // Avoid duplicating the agent message already added by 'message' type
                const lastMsg = state.messages[state.messages.length - 1];
                const lastRole = lastMsg?.role?.toLowerCase();
                const needsNew = !lastMsg || (lastRole !== 'agent' && lastRole !== 'system');
                if (needsNew) {
                  msgs = [
                    ...state.messages,
                    {
                      id: crypto.randomUUID?.() || uid(),
                      role: 'agent',
                      agent_name: 'Agent',
                      content: codeContent,
                      round_number: 0,
                      created_at: new Date().toISOString(),
                    },
                  ];
                }
              }
              return {
                streamingId: null,
                messages: msgs,
                status: 'completed',
                currentRole: null,
                result: {
                  requirement: '',
                  pm_document: msg.pm_document ?? '',
                  code: codeContent,
                  review: msg.review ?? '',
                  approved: msg.approved ?? false,
                  status: msg.status ?? 'completed',
                },
              };
            });
            if (get().currentRunId) {
              disconnectRun(get().currentRunId!);
            }
            const st = get();
            if (st.messages.length) {
              _syncConversationToLocalStorage({
                title: requirement,
                agentId: agent_id,
                sessionId: st.currentSessionId || undefined,
                convId: st.currentConvId || undefined,
                messages: st.messages,
              });
            }
            return;
          }
        },
        onStatusChange: (wsStatus: WsConnectionStatus) => {
          set({ wsStatus });
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败';
      set({ status: 'error', error: message, wsStatus: 'disconnected' });
    }
  },

  addMessage: (msg: WsMessage) => {
    const m: ChatMessage = {
      id: crypto.randomUUID?.() || uid(),
      role: msg.role!,
      agent_name: msg.agent_name!,
      content: msg.content!,
      round_number: msg.round_number ?? 0,
      created_at: new Date().toISOString(),
    };
    set((state) => ({ messages: [...state.messages, m], currentRole: msg.role! }));
  },

  setStatus: (status: AppStatus) => set({ status }),
  setResult: (result: RunResult) => set({ result }),
  setError: (error: string | null) => set({ error }),
  selectAgent: (_agentId: string) => {
    const prev = get().currentSessionId;
    if (prev) set({ currentSessionId: null, messages: [], status: 'idle' });
  },
  setWsStatus: (wsStatus: WsConnectionStatus) => set({ wsStatus }),

  reset: () => {
    const prevRunId = get().currentRunId;
    if (prevRunId) {
      Logger.info(`[chat] reset — disconnecting run ${prevRunId}`);
      disconnectRun(prevRunId);
    }
    set({
      currentRunId: null,
      currentSessionId: null,
      currentConvId: null,
      messages: [],
      status: 'idle',
      result: null,
      currentRole: null,
      error: null,
      streamingId: null,
      interruptedMessageId: null,
      continuingId: null,
      skipThinking: false,
      wsStatus: 'disconnected',
    });
  },

  /** @deprecated kept for backward compat — use React Query useAgents() */
  loadAgents: async () => {
    try {
      const agents = await listAgents();
      set({ agents, agentsLoaded: true });
    } catch {
      set({ agents: [], agentsLoaded: true });
    }
  },
}));

// ── localStorage sync for agent conversations ──────────────────────────────
function _syncConversationToLocalStorage(params: {
  title: string;
  agentId?: string;
  sessionId?: string;
  convId?: string;
  messages: ChatMessage[];
}) {
  try {
    const { title, agentId, sessionId, convId, messages } = params;
    if (!messages.length) return;
    const STORAGE_KEY = 'devagents-conversations';
    const existing: Array<{ id: string; agentId?: string; sessionId?: string; messages: unknown[]; [k: string]: unknown }> =
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    // Primary match by convId, fallback to sessionId, then agentId+title
    const conv = convId
      ? existing.find((c) => c.id === convId)
      : existing.find(
          (c) => (sessionId && c.sessionId === sessionId) || (agentId && c.agentId === agentId && c.title === title),
        );

    const mapped = messages.map((m) => ({
      id: Date.now(),
      role: m.role,
      agentId,
      content: m.content,
      thinking: m.thinking,
      thinkingDone: m.thinkingDone,
      timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
    }));

    if (conv) {
      conv.messages = mapped;
      conv.updatedAt = new Date().toISOString();
      Logger.debug(`[chat] sync ${messages.length} msgs to conv ${conv.id}`);
    } else {
      existing.unshift({
        id: crypto.randomUUID(),
        title: title.length > 36 ? title.slice(0, 36) + '...' : title,
        agentId,
        sessionId,
        messages: mapped,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      Logger.debug(`[chat] created conv for ${title.slice(0, 24)}...`);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 50)));
    window.dispatchEvent(new Event('devagents-conversations-updated'));
  } catch {
    // non-fatal
  }
}
