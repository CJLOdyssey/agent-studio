import Logger from '../utils/logger';
import { uid } from './uid';
import type { ChatState } from './chatTypes';
import type { ChatMessage, RunResult } from '../types';

function makeRunResult(code: string): RunResult {
  return { code, requirement: '', pm_document: '', review: '', approved: false, status: 'completed' };
}
import type { WsThinkingDoneEvent, WsResultEvent, WsTeamResultEvent, WsThumbsEvent } from './wsEvents';

type SetFn = (fn: (state: ChatState) => Partial<ChatState> | Partial<ChatState>) => void;
type GetFn = () => ChatState;

export function handleThinkingDone(s: ChatState, msg: WsThinkingDoneEvent): Partial<ChatState> {
  const continuingId = s.continuingId;
  const pending = s.pendingVersions;
  const pendingThinking = s.pendingThinkingVersions;
  if (!continuingId) {
    return {};
  }
  Logger.warn('[chat] continue thinking_done — no streamingId; falling back to direct replacement (continuingId=%s)', continuingId);
  const contIdx = s.messages.findIndex((m) => m.id === continuingId);
  const oldMsg = contIdx >= 0 ? s.messages[contIdx] : null;
  const oldContent = oldMsg?.content || '';
  const oldThinking = oldMsg?.thinking || '';
  const base = contIdx >= 0 ? s.messages.slice(0, contIdx) : s.messages.filter((m) => m.id !== continuingId);
  const newId = crypto.randomUUID?.() || uid();
  const newVersions = pending ? [...pending] : undefined;
  const newThinkingVersions = pendingThinking ? [...pendingThinking] : undefined;
  if (newVersions && newVersions.length > 0) {
    newVersions[newVersions.length - 1] = oldContent;
  }
  if (newThinkingVersions && newThinkingVersions.length > 0) {
    newThinkingVersions[newThinkingVersions.length - 1] = msg.thinking || oldThinking;
  }
  return {
    streamingId: newId,
    continuingId: null,
    pendingVersions: null,
    pendingThinkingVersions: null,
    messages: [
      ...base,
      {
        id: newId,
        role: 'agent',
        agent_name: oldMsg?.agent_name || msg.agent_name || 'Agent',
        content: oldContent,
        thinking: msg.thinking || oldThinking,
        round_number: 0,
        created_at: new Date().toISOString(),
        versions: newVersions,
        thinkingVersions: newThinkingVersions,
        currentVersion: newVersions ? newVersions.length - 1 : undefined,
      },
    ],
    currentRole: msg.agent_name || 'Agent',
    wsStatus: 'connected' as ChatState['wsStatus'],
  };
}

export function handleThinkingDoneEvent(set: SetFn, msg: WsThinkingDoneEvent): void {
  set((s) => {
    if (s.streamingId) {
      return {
        messages: s.messages.map((m) =>
          m.id === s.streamingId ? { ...m, thinkingDone: true } : m,
        ),
      };
    }
    return handleThinkingDone(s, msg);
  });
}

export function handleResultEvent(
  set: SetFn,
  get: GetFn,
  activeStreamMsgIds: Set<string>,
  msg: WsResultEvent,
): void {
  const runId = get().currentRunId;
    const codeContent: string = msg.code ? String(msg.code) : '';
  set((_s) => {
    let msgs = _s.messages;
    if (_s.streamingId) {
      msgs = _s.messages.map((m) => {
        if (m.id !== _s.streamingId) return m;
        const updated: Record<string, unknown> = {};
        if (codeContent) updated.content = codeContent;
        if (m.thinking === '') updated.thinking = undefined;
        return { ...m, ...updated, thinkingDone: true } as ChatMessage;
      });
    }
    return {
      messages: msgs,
      status: 'idle' as ChatState['status'],
      streamingId: null,
      result: makeRunResult(codeContent),
      skipThinking: false,
    };
  });
  Logger.info('[chat] result received — status set to idle');
  activeStreamMsgIds.delete(runId || '');
}

export function handleTeamResultEvent(
  set: SetFn,
  get: GetFn,
  activeStreamMsgIds: Set<string>,
  _msg: WsTeamResultEvent,
): void {
  const runId = get().currentRunId;
  set((_s) => {
    let msgs = _s.messages;
    if (_s.streamingId) {
      msgs = _s.messages.map((m) => {
        if (m.id !== _s.streamingId) return m;
        return { ...m, thinkingDone: true } as ChatMessage;
      });
    }
    return {
      messages: msgs,
      status: 'idle' as ChatState['status'],
      streamingId: null,
      skipThinking: false,
    };
  });
  Logger.info('[chat] team_result received — status set to idle');
  activeStreamMsgIds.delete(runId || '');
}

export function handleThumbsEvent(set: SetFn, msg: WsThumbsEvent): void {
  set((s) => ({
    messages: s.messages.map((m) =>
      m.id === msg.msgId ? { ...m, thumbs: msg.value } : m,
    ),
  }));
}
