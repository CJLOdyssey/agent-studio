/** 聊天流式输出的 WebSocket 事件类型 */

export interface WsStreamEvent {
  type: 'stream';
  content?: string;
  thinking?: string;
  agent_name?: string;
}

export interface WsThinkingStreamEvent {
  type: 'thinking_stream';
  content?: string;
  thinking?: string;
  agent_name?: string;
}

export interface WsMessageEvent {
  type: 'message';
  content?: string;
  thinking?: string;
  role?: string;
  agent_name?: string;
  round_number?: number;
}

export interface WsThinkingDoneEvent {
  type: 'thinking_done';
  thinking?: string;
  agent_name?: string;
}

export interface WsInfoEvent {
  type: 'info';
  content?: string;
  data?: string;
}

export interface WsErrorEvent {
  type: 'error';
  content?: string;
}

export interface WsBalanceWarningEvent {
  type: 'balance_warning';
  content?: string;
}

export interface WsOpenUrlEvent {
  type: 'open_url';
  url?: string;
}

export interface WsBrowserFrameEvent {
  type: 'browser_frame';
  data: string;
}

export interface WsResultEvent {
  type: 'result';
  run_id?: string;
  [key: string]: unknown;
}

export interface WsCancelledEvent {
  type: 'cancelled';
  run_id?: string;
}

/** N1 团队后端返回的按角色 verdict（contract-N1）。 */
export interface TeamVerdict {
  role: string;
  approved: boolean;
  reason?: string;
  score?: number;
  rounds: number;
}

export interface WsTeamResultEvent {
  type: 'team_result';
  status?: string;
  team_id?: string;
  artifacts?: Record<string, unknown>;
  display?: string;
  verdicts?: Record<string, TeamVerdict>;
  rounds?: number;
  [key: string]: unknown;
}

export interface WsApprovalRequestEvent {
  type: 'approval_request';
  run_id?: string;
  node?: string;
}

export interface WsThumbsEvent {
  type: 'thumbs';
  [key: string]: unknown;
}

export type WsEvent =
  | WsStreamEvent
  | WsThinkingStreamEvent
  | WsMessageEvent
  | WsThinkingDoneEvent
  | WsInfoEvent
  | WsErrorEvent
  | WsBalanceWarningEvent
  | WsOpenUrlEvent
  | WsBrowserFrameEvent
  | WsResultEvent
  | WsCancelledEvent
  | WsTeamResultEvent
  | WsApprovalRequestEvent
  | WsThumbsEvent;
