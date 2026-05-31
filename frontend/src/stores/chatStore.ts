import { create } from 'zustand';
import type { AgentConfig, AppStatus, ChatMessage, RunResult, WsMessage } from '../types';
import { connectRun, disconnectRun } from '../api/websocket';

const uid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
import {
  submitRequirement,
  listAgents,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
  toggleAgent as apiToggleAgent,
} from '../api/client';

interface ChatState {
  currentRunId: string | null;
  currentSessionId: string | null;
  messages: ChatMessage[];
  status: AppStatus;
  result: RunResult | null;
  currentRole: string | null;
  error: string | null;
  agents: AgentConfig[];
  agentsLoaded: boolean;

  submitRequirement: (requirement: string, session_id?: string) => Promise<void>;
  restoreSession: (sessionId: string, runId: string, messages: ChatMessage[], result: RunResult | null, status: AppStatus) => void;
  addMessage: (msg: WsMessage) => void;
  setStatus: (status: AppStatus) => void;
  setResult: (result: RunResult) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  loadAgents: () => Promise<void>;
  createAgent: (cfg: {
    name: string;
    role_identifier: string;
    system_prompt: string;
    order: number;
    is_active: boolean;
    is_approver: boolean;
    icon: string;
    model?: string | null;
    temperature?: number | null;
  }) => Promise<void>;
  updateAgent: (id: string, cfg: {
    name?: string;
    system_prompt?: string;
    order?: number;
    is_active?: boolean;
    is_approver?: boolean;
    icon?: string;
    model?: string | null;
    temperature?: number | null;
  }) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  toggleAgent: (id: string) => Promise<void>;
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
      set({ currentRunId: run_id, currentSessionId: session_id || null, status: 'running' });

      connectRun(run_id, (data) => {
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
          }));
        } else if (msg.type === 'status') {
          if (msg.status === 'error') {
            set({ status: 'error', error: msg.error ?? '未知错误' });
          }
        } else if (msg.type === 'result') {
          set({
            status: 'completed',
            currentRole: null,
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
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败';
      set({ status: 'error', error: message });
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
    });
  },

  loadAgents: async () => {
    try {
      const agents = await listAgents();
      set({ agents, agentsLoaded: true });
    } catch {
      set({ agents: [], agentsLoaded: true });
    }
  },

  createAgent: async (cfg) => {
    await apiCreateAgent(cfg);
    await get().loadAgents();
  },

  updateAgent: async (id, cfg) => {
    await apiUpdateAgent(id, cfg);
    await get().loadAgents();
  },

  deleteAgent: async (id) => {
    await apiDeleteAgent(id);
    await get().loadAgents();
  },

  toggleAgent: async (id) => {
    await apiToggleAgent(id);
    await get().loadAgents();
  },
}));
