import { create } from 'zustand';
import type { AgentConfig, AppStatus, ChatMessage, RunResult, WsMessage } from '../types';
import { connectRun, disconnectRun } from '../api/websocket';
import { submitRequirement, listAgents } from '../api/client';

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

  /**
   * @deprecated Use `useAgents()` from `@/api/hooks` (React Query) as the single source of truth.
   * Kept for backward compatibility with legacy components (MessageBubble, ConfigPanel).
   * Will be removed once all consumers migrate to React Query.
   */
  agents: AgentConfig[];
  /** @deprecated Use `useAgents().isSuccess` instead. */
  agentsLoaded: boolean;

  wsStatus: WsConnectionStatus;

  submitRequirement: (requirement: string, session_id?: string) => Promise<void>;
  restoreSession: (sessionId: string, runId: string, messages: ChatMessage[], result: RunResult | null, status: AppStatus) => void;
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
  agents: [],
  agentsLoaded: false,
  wsStatus: 'disconnected',

  restoreSession: (sessionId: string, runId: string, messages: ChatMessage[], result: RunResult | null, status: AppStatus) => {
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

  submitRequirement: async (requirement: string, session_id?: string) => {
    const prevRunId = get().currentRunId;
    if (prevRunId) {
      disconnectRun(prevRunId);
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
      const { run_id } = await submitRequirement(requirement, session_id);
      set({ currentRunId: run_id, currentSessionId: session_id || null, status: 'running', wsStatus: 'connecting' });

      connectRun(run_id, {
        onMessage: (data) => {
          const msg = data as unknown as WsMessage;
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
          } else if (msg.type === 'status') {
            if (msg.status === 'error') {
              set({ status: 'error', error: msg.error ?? '未知错误', wsStatus: 'disconnected' });
            }
          } else if (msg.type === 'result') {
            set({
              status: 'completed',
              currentRole: null,
              wsStatus: 'disconnected',
              result: {
                requirement: '',
                pm_document: msg.pm_document ?? '',
                code: msg.code ?? '',
                review: msg.review ?? '',
                approved: msg.approved ?? false,
                status: msg.status ?? 'completed',
              },
            });
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
