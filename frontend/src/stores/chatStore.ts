import { create } from 'zustand';
import type { AppStatus, ChatMessage, RunResult } from '../types';
import { disconnectRun } from '../api/websocket';
import { cancelRun as cancelRunApi } from '../api/client';
import Logger from '../utils/logger';
import { uid } from './uid';
import type { ChatState } from './chatTypes';

export type { WsConnectionStatus, ChatState } from './chatTypes';

const INITIAL_STATE = {
  currentRunId: null,
  activeRunId: null,
  pendingRegenerate: null,
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
  editTargetId: null,
  skipThinking: false,
  pendingVersions: null,
  pendingThinkingVersions: null,
  wsStatus: 'disconnected' as ChatState['wsStatus'],
  submissionConvId: null,
  activeTeamId: null,
  selectedAgentId: null as string | null,
};

// 版本分页通用计算：方向 → 合法索引（越界夹取），未变时返回 null。
function clampVersion(total: number, cur: number, direction: 'prev' | 'next') {
  const nv =
    direction === 'prev' ? Math.max(0, cur - 1) : Math.min(total - 1, cur + 1);
  return nv === cur ? null : nv;
}

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
    set((prev) => {
      // 加载同一会话时保留 in-flight 状态：新建会话提交中，submitRequirement
      // 已绑定 sessionId / 已写入 error（失败横幅），navigate 触发的加载不得
      // 把它们覆盖成 null（真实浏览器慢网络下同样存在此竞态）。
      const sameConv = convId != null && prev.currentConvId === convId;
      return {
        messages,
        currentConvId: convId ?? null,
        currentSessionId: sessionId ?? (sameConv ? prev.currentSessionId : null),
        currentRunId: null,
        streamingId: null,
        status: sameConv ? prev.status : 'idle',
        wsStatus: 'disconnected',
        lastAbandonedRunId: prevRunId,
        error: sameConv ? prev.error : null,
        skipThinking: false,
        continuingId: null,
        interruptedMessageId: null,
        submissionConvId: null,
      };
    });
  },

  cancelRun: () => {
    const s = get();
    const prevRunId = s.currentRunId;
    const sid = s.streamingId;
    if (prevRunId) {
      Logger.info('[chat] cancelRun — cancelling run %s', prevRunId);
      disconnectRun(prevRunId);
      // 真取消：通知后端终止任务并中断上游 LLM 流（fire-and-forget）。
      void cancelRunApi(prevRunId).catch((err) => {
        Logger.warn(
          '[chat] cancelRun API failed for %s: %s',
          prevRunId,
          String(err),
        );
      });
    }
    set({ currentRunId: null, streamingId: null, status: 'idle', wsStatus: 'disconnected', interruptedMessageId: sid, continuingId: null, skipThinking: false });
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

  // 用户消息版本切换（分支语义）：计算目标 runId（越界夹取），null = 无变化。
  resolveUserVersionTarget: (msgId, direction) => {
    const msg = get().messages.find((m) => m.id === msgId);
    if (!msg) return null;
    const versions = msg.userVersions;
    const versionRunIds = msg.versionRunIds;
    if (!versions || versions.length < 2) return null;
    const nv = clampVersion(
      versions.length,
      msg.currentUserVersion ?? versions.length - 1,
      direction,
    );
    if (nv === null) return null;
    return versionRunIds?.[nv] ?? null;
  },

  // 模型消息答案分页（重新生成分支，与用户消息 1:N）：计算目标 runId。
  resolveAnswerVersionTarget: (msgId, direction) => {
    const msg = get().messages.find((m) => m.id === msgId);
    if (!msg) return null;
    const versions = msg.answerVersions;
    const runIds = msg.answerRunIds;
    if (!versions || !runIds || versions.length < 2) return null;
    const nv = clampVersion(
      versions.length,
      msg.currentAnswerVersion ?? versions.length - 1,
      direction,
    );
    if (nv === null) return null;
    return runIds[nv] ?? null;
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

  switchUserVersion: (msgId, direction) => {
    set((s) => ({ messages: s.messages.map((m) => {
      if (m.id !== msgId || !m.userVersions) return m;
      const max = m.userVersions.length - 1;
      const cv = m.currentUserVersion ?? max;
      const nv = direction === 'prev' ? Math.max(0, cv - 1) : Math.min(max, cv + 1);
      return { ...m, currentUserVersion: nv, content: m.userVersions[nv] };
    }) }));
  },

  setThumbsFeedback: (msgId, value) => {
    set((s) => ({ messages: s.messages.map((m) => m.id === msgId ? { ...m, thumbs: value } : m) }));
  },

  selectAgent: (_agentId) => {
    set({ selectedAgentId: _agentId });
  },

  setActiveTeam: (teamId) => {
    set({ activeTeamId: teamId });
  },

  setActiveRunId: (runId) => {
    set({ activeRunId: runId });
  },
}));

export { submitRequirement, editMessage, editAndRegenerate, regenerateMessage, retry, continueGeneration } from './chatActions';
