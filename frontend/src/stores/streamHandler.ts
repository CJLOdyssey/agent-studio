import Logger from '../utils/logger';
import { uid } from './uid';
import type { ChatState } from './chatTypes';
import type { WsStreamEvent, WsThinkingStreamEvent } from './wsEvents';

type SetFn = (fn: (state: ChatState) => Partial<ChatState> | Partial<ChatState>) => void;
type GetFn = () => ChatState;

export function handleStreamStart(s: ChatState, msg: WsStreamEvent, chunk: string): Partial<ChatState> {
  const newId = crypto.randomUUID?.() || uid();
  const pending = s.pendingVersions;
  const pendingThinking = s.pendingThinkingVersions;
  const continuingId = s.continuingId;
  if (continuingId) {
    Logger.info('[chat] continue stream — replacing interrupted msg (continuingId=%s, newId=%s)', continuingId, newId);
    const contIdx = s.messages.findIndex((m) => m.id === continuingId);
    const oldMsg = contIdx >= 0 ? s.messages[contIdx] : null;
    const oldContent = oldMsg?.content || '';
    const oldThinking = oldMsg?.thinking || '';
    const base = contIdx >= 0 ? s.messages.slice(0, contIdx) : s.messages;
    const newVersions = pending ? [...pending] : undefined;
    const newThinkingVersions = pendingThinking ? [...pendingThinking] : undefined;
    if (newVersions && newVersions.length > 0) {
      newVersions[newVersions.length - 1] = oldContent;
    }
    if (newThinkingVersions && newThinkingVersions.length > 0) {
      newThinkingVersions[newThinkingVersions.length - 1] = oldThinking;
    }
    return {
      streamingId: newId, continuingId: null, pendingVersions: null, pendingThinkingVersions: null, skipThinking: false,
      messages: [...base, { id: newId, role: 'agent', agent_name: oldMsg?.agent_name || msg.agent_name || 'Agent', content: oldContent + chunk, thinking: oldThinking, round_number: 0, created_at: new Date().toISOString(), versions: newVersions, thinkingVersions: newThinkingVersions, currentVersion: newVersions ? newVersions.length - 1 : undefined }],
      currentRole: msg.agent_name || 'Agent', wsStatus: 'connected' as ChatState['wsStatus'],
    };
  }
  return {
    streamingId: newId, pendingVersions: null, pendingThinkingVersions: null, skipThinking: false,
    messages: [...s.messages, { id: newId, role: 'agent', agent_name: msg.agent_name || 'Agent', content: chunk, thinking: '', round_number: 0, created_at: new Date().toISOString(), versions: pending ? [...pending, chunk] : undefined, thinkingVersions: pendingThinking ? [...pendingThinking, ''] : undefined, currentVersion: pending ? pending.length : undefined }],
    currentRole: msg.agent_name || 'Agent', wsStatus: 'connected' as ChatState['wsStatus'],
  };
}

export function handleThinkingStreamNew(s: ChatState, msg: WsThinkingStreamEvent, chunk: string): Partial<ChatState> {
  const newId = crypto.randomUUID?.() || uid();
  const continuingId = s.continuingId;
  const pending = s.pendingVersions;
  const pendingThinking = s.pendingThinkingVersions;
  if (continuingId) {
    const contIdx = s.messages.findIndex((m) => m.id === continuingId);
    const oldMsg = contIdx >= 0 ? s.messages[contIdx] : null;
    const oldContent = oldMsg?.content || '';
    const oldThinking = oldMsg?.thinking || '';
    const base = contIdx >= 0 ? s.messages.slice(0, contIdx) : s.messages;
    const newVersions = pending ? [...pending] : undefined;
    const newThinkingVersions = pendingThinking ? [...pendingThinking] : undefined;
    if (newVersions && newVersions.length > 0) {
      newVersions[newVersions.length - 1] = oldContent;
    }
    if (newThinkingVersions && newThinkingVersions.length > 0) {
      newThinkingVersions[newThinkingVersions.length - 1] = oldThinking + chunk;
    }
    return {
      streamingId: newId,
      continuingId: null,
      pendingVersions: null,
      pendingThinkingVersions: null,
      skipThinking: false,
      messages: [
        ...base,
        {
          id: newId,
          role: 'agent',
          agent_name: oldMsg?.agent_name || msg.agent_name || 'Agent',
          content: oldContent,
          thinking: oldThinking + chunk,
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
  return {
    streamingId: newId,
    continuingId: null,
    pendingVersions: null,
    pendingThinkingVersions: null,
    messages: [
      ...s.messages,
      {
        id: newId,
        role: 'agent',
        agent_name: msg.agent_name || 'Agent',
        content: '',
        thinking: chunk,
        round_number: 0,
        created_at: new Date().toISOString(),
        versions: pending ? [...pending, ''] : undefined,
        thinkingVersions: pendingThinking ? [...pendingThinking, chunk] : undefined,
        currentVersion: pending ? pending.length : undefined,
      },
    ],
    currentRole: msg.agent_name || 'Agent',
    wsStatus: 'connected' as ChatState['wsStatus'],
  };
}

export function handleStreamEvent(
  set: SetFn,
  get: GetFn,
  activeStreamMsgIds: Set<string>,
  msg: WsStreamEvent,
): void {
  const chunk = msg.content || '';
  if (!chunk) return;
  const s = get();
  if (activeStreamMsgIds.has(s.currentRunId || '')) {
    set((prev) => {
      if (!prev.streamingId) return {};
      return {
        skipThinking: false,
        messages: prev.messages.map((m) => {
          if (m.id !== prev.streamingId) return m;
          return { ...m, content: m.content + chunk, thinking: m.thinking ?? '' };
        }),
        currentRole: msg.agent_name || 'Agent',
        wsStatus: 'connected' as ChatState['wsStatus'],
      };
    });
    return;
  }
  activeStreamMsgIds.add(s.currentRunId || '');
  set((prev) => {
    return handleStreamStart(prev, msg, chunk);
  });
}

export function handleThinkingStreamEvent(
  set: SetFn,
  get: GetFn,
  activeStreamMsgIds: Set<string>,
  msg: WsThinkingStreamEvent,
): void {
  const chunk = msg.content || '';
  if (!chunk) return;
  const s = get();
  if (activeStreamMsgIds.has(s.currentRunId || '')) {
    set((prev) => {
      if (!prev.streamingId) return {};
      return {
        messages: prev.messages.map((m) => {
          if (m.id !== prev.streamingId) return m;
          return { ...m, thinking: (m.thinking ?? '') + chunk };
        }),
      };
    });
    return;
  }
  activeStreamMsgIds.add(s.currentRunId || '');
  set((s) => {
    if (s.streamingId) {
      return {
        messages: s.messages.map((m) => {
          if (m.id !== s.streamingId) return m;
          const updatedThinking = (m.thinking ?? '') + chunk;
          return { ...m, thinking: updatedThinking };
        }),
      };
    }
    return handleThinkingStreamNew(s, msg, chunk);
  });
}
