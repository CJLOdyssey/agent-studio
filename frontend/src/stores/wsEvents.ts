/** WebSocket event types for chat streaming */

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

export interface WsResultEvent {
  type: 'result';
  run_id?: string;
  [key: string]: unknown;
}

export interface WsTeamResultEvent {
  type: 'team_result';
  [key: string]: unknown;
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
  | WsResultEvent
  | WsTeamResultEvent
  | WsThumbsEvent;
