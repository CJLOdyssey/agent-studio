import { create } from 'zustand';
import type { AgentConfig, AppStatus, ChatMessage, RunResult, WsMessage } from '../types';
import { connectRun, disconnectRun } from '../api/websocket';
import { submitRequirement, listAgents, listKeys } from '../api/client';

const uid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface ChatState {
  currentRunId: string | null;
  currentSessionId: string | null;
  messages: ChatMessage[];
  status: AppStatus;
  result: RunResult | null;
  currentRole: string | null;
  error: string | null;
  streamingId: string | null;

  /**
   * @deprecated Use `useAgents()` from `@/api/hooks` (React Query) as the single source of truth.
   * Kept for backward compatibility with legacy components (MessageBubble, ConfigPanel).
   * Will be removed once all consumers migrate to React Query.
   */
  agents: AgentConfig[];
  /** @deprecated Use `useAgents().isSuccess` instead. */
  agentsLoaded: boolean;

  wsStatus: WsConnectionStatus;

  submitRequirement: (requirement: string, session_id?: string, agent_id?: string) => Promise<void>;
  restoreSession: (
    sessionId: string,
    runId: string,
    messages: ChatMessage[],
    result: RunResult | null,
    status: AppStatus,
  ) => void;
  loadConversation: (messages: ChatMessage[]) => void;
  addMessage: (msg: WsMessage) => void;
  setStatus: (status: AppStatus) => void;
  setResult: (result: RunResult) => void;
  setError: (error: string | null) => void;
  setWsStatus: (wsStatus: WsConnectionStatus) => void;
  reset: () => void;

  /** @deprecated Use `prefetchAgents(queryClient)` from `@/api/hooks` instead. */
  loadAgents: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  currentRunId: null,
  currentSessionId: null,
  messages: [],
  status: 'idle',
  result: null,
  currentRole: null,
  error: null,
  streamingId: null,
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

  loadConversation: (messages: ChatMessage[]) => {
    set({
      messages,
      status: 'idle',
      error: null,
      currentRole: messages.length > 0 ? messages[messages.length - 1].role : null,
    });
  },

  submitRequirement: async (requirement: string, session_id?: string, agent_id?: string) => {
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
        model = defaultKey.models[0];
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
      messages: [...get().messages, userMsg],
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
                  messages: state.messages.map((m) =>
                    m.id === state.streamingId ? { ...m, content: m.content + chunk } : m,
                  ),
                  currentRole: msg.agent_name || 'Agent',
                  wsStatus: 'connected' as WsConnectionStatus,
                };
              }
              const newId = crypto.randomUUID?.() || uid();
              return {
                streamingId: newId,
                messages: [
                  ...state.messages,
                  {
                    id: newId,
                    role: 'agent',
                    agent_name: msg.agent_name || 'Agent',
                    content: chunk,
                    round_number: 0,
                    created_at: new Date().toISOString(),
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
              if (state.streamingId && codeContent) {
                msgs = state.messages.map((m) => (m.id === state.streamingId ? { ...m, content: codeContent } : m));
              } else if (!state.streamingId && codeContent) {
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
  setWsStatus: (wsStatus: WsConnectionStatus) => set({ wsStatus }),

  reset: () => {
    const prevRunId = get().currentRunId;
    if (prevRunId) disconnectRun(prevRunId);
    set({
      currentRunId: null,
      currentSessionId: null,
      messages: [],
      status: 'idle',
      result: null,
      currentRole: null,
      error: null,
      streamingId: null,
      wsStatus: 'disconnected',
    });
  },

  // @deprecated — kept for backward compat; use React Query useAgents() + prefetchAgents()
  loadAgents: async () => {
    try {
      const agents = await listAgents();
      set({ agents, agentsLoaded: true });
    } catch {
      set({ agents: [], agentsLoaded: true });
    }
  },
}));
