import type { AppStatus, ChatMessage, RunResult } from '../types';

export type WsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ChatState {
  currentRunId: string | null;
  currentSessionId: string | null;
  currentConvId: string | null;
  messages: ChatMessage[];
  status: AppStatus;
  result: RunResult | null;
  currentRole: string | null;
  error: string | null;
  streamingId: string | null;
  lastAbandonedRunId: string | null;
  interruptedMessageId: string | null;
  continuingId: string | null;
  /** When set, the next streamed answer merges into this agent message as a new version (edit-regenerate) */
  editTargetId: string | null;
  skipThinking: boolean;
  pendingVersions: string[] | null;
  pendingThinkingVersions: string[] | null;
  switchVersion: (msgId: string, direction: 'prev' | 'next') => void;
  switchUserVersion: (msgId: string, direction: 'prev' | 'next') => void;
  /** 用户消息版本切换（分支语义）：计算目标 runId（越界夹取），null = 无变化 */
  resolveUserVersionTarget: (msgId: string, direction: 'prev' | 'next') => string | null;
  /** 模型消息答案分页（重新生成分支）：计算目标 runId */
  resolveAnswerVersionTarget: (msgId: string, direction: 'prev' | 'next') => string | null;
  setThumbsFeedback: (msgId: string, value: 'up' | 'down' | null) => void;
  wsStatus: WsConnectionStatus;
  /** Conversation ID at submission time */
  submissionConvId: string | null;
  /** Active team for multi-agent workflow */
  activeTeamId: string | null;
  selectedAgentId: string | null;

  setActiveTeam: (teamId: string | null) => void;
  restoreSession: (sessionId: string, runId: string, messages: ChatMessage[], result: RunResult | null, status: AppStatus) => void;
  loadConversation: (messages: ChatMessage[], convId?: string | null, sessionId?: string | null) => void;
  cancelRun: () => void;
  addMessage: (msg: import('../types').WsMessage & { id?: string }) => void;
  setStatus: (status: AppStatus) => void;
  setResult: (result: RunResult | null) => void;
  setError: (error: string | null) => void;
  setWsStatus: (wsStatus: WsConnectionStatus) => void;
  reset: () => void;
  selectAgent: (agentId: string) => void;
}