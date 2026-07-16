import Logger from '../utils/logger';
import { uid } from './uid';
import type { ChatState } from './chatTypes';

type SetFn = (fn: (state: ChatState) => Partial<ChatState> | Partial<ChatState>) => void;

export function handleMessageEvent(set: SetFn, msg: any): void {
  set((s) => {
    if (s.streamingId) {
      return {
        messages: s.messages.map((m) => {
          if (m.id !== s.streamingId) return m;
          const newThinking = msg.thinking ?? m.thinking;
          const cv = m.currentVersion ?? 0;
          const tvBase = m.thinkingVersions?.length ? m.thinkingVersions : (m.thinking ? [m.thinking] : []);
          const newTV = [...tvBase];
          if (newTV[cv] !== undefined) {
            newTV[cv] = newThinking ?? '';
          }
          return { ...m, content: msg.content!, thinking: newThinking, thinkingVersions: newTV };
        }),
        currentRole: msg.role!,
        wsStatus: 'connected' as ChatState['wsStatus'],
      };
    }
    Logger.warn('[chat] message event with no streamingId — creating new msg');
    const m = {
      id: crypto.randomUUID?.() || uid(),
      role: msg.role!,
      agent_name: msg.agent_name!,
      content: msg.content!,
      thinking: msg.thinking,
      round_number: msg.round_number ?? 0,
      created_at: new Date().toISOString(),
    };
    return {
      messages: [...s.messages, m],
      currentRole: msg.role!,
      wsStatus: 'connected' as ChatState['wsStatus'],
    };
  });
}

export function handleInfoEvent(set: SetFn, msg: any): void {
  set((s) => {
    const infoContent = msg.content || typeof msg.data === 'string' ? msg.data : '';
    if (s.streamingId) {
      return {
        messages: s.messages.map((m) =>
          m.id === s.streamingId
            ? { ...m, content: m.content + (infoContent ? `\n[${infoContent}]` : '') }
            : m,
        ),
      };
    }
    return {};
  });
}

export function handleErrorEvent(set: SetFn, msg: any): void {
  Logger.error('[chat] error event:', msg.content);
  set((_s) => ({ status: 'error' as any as ChatState['status'], error: msg.content || 'Unknown error', wsStatus: 'connected' as ChatState['wsStatus'] }));
}

export function handleBalanceWarningEvent(set: SetFn, msg: any): void {
  Logger.error('[chat] balance warning:', msg.content);
  set((_s) => ({ status: 'error' as any as ChatState['status'], error: msg.content || '模型余额不足', wsStatus: 'connected' as ChatState['wsStatus'] }));
}

export function handleOpenUrlEvent(msg: any): void {
  const targetUrl: string = msg.url || '';
  if (targetUrl) {
    Logger.info('[chat] open_url: %s', targetUrl);
    window.open(targetUrl, '_blank');
  }
}
