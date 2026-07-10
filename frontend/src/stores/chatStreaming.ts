import Logger from '../utils/logger';
import { uid } from './uid';
import type { ChatState } from './chatTypes';

type SetFn = (fn: (state: ChatState) => Partial<ChatState> | Partial<ChatState>) => void;
type GetFn = () => ChatState;

const _activeStreamMsgIds = new Set<string>();

export function createStreamHandler(set: SetFn, get: GetFn) {
  return (data: unknown) => {
    const msg = data as any;

    if (msg.type === 'stream') {
      const chunk = msg.content || '';
      if (!chunk) return;
      const s = get();
      if (_activeStreamMsgIds.has(s.currentRunId || '')) {
        // Already have a streaming message — append to it
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
      // First stream event — mark run and create message
      _activeStreamMsgIds.add(s.currentRunId || '');
      set((prev) => {
        return handleStreamStart(prev, msg, chunk);
      });
      return;
    }

    if (msg.type === 'thinking_stream') {
      const chunk = msg.content || '';
      if (!chunk) return;
      const s = get();
      if (_activeStreamMsgIds.has(s.currentRunId || '')) {
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
      _activeStreamMsgIds.add(s.currentRunId || '');
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
      return;
    }

    if (msg.type === 'message') {
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
      return;
    }

    if (msg.type === 'thinking_done') {
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
      return;
    }

    if (msg.type === 'info') {
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
      return;
    }

    if (msg.type === 'error') {
      Logger.error('[chat] error event:', msg.content);
      set((_s) => ({ status: 'error' as any as ChatState['status'], error: msg.content || 'Unknown error', wsStatus: 'connected' as ChatState['wsStatus'] }));
      return;
    }

if (msg.type === 'open_url') {
      const targetUrl: string = msg.url || '';
      if (targetUrl) {
        Logger.info('[chat] open_url: %s', targetUrl);
        window.open(targetUrl, '_blank');
      }
      return;
    }

    if (msg.type === 'result') {
      const runId = get().currentRunId;
      const codeContent = msg.code ?? '';
      set((_s) => {
        let msgs = _s.messages;
        if (_s.streamingId) {
          msgs = _s.messages.map((m) => {
            if (m.id !== _s.streamingId) return m;
            const updated: Record<string, unknown> = {};
            if (codeContent) updated.content = codeContent;
            if (m.thinking === '') updated.thinking = undefined;
            return { ...m, ...updated, thinkingDone: true } as any;
          });
        }
        return {
          messages: msgs,
          status: 'idle' as ChatState['status'],
          streamingId: null,
          result: { code: codeContent, run_id: _s.currentRunId, requirement: '', pm_document: '', review: '', approved: false, status: 'completed' },
          skipThinking: false,
        };
      });
      Logger.info('[chat] result received — status set to idle');
      _activeStreamMsgIds.delete(runId || '');
      return;
    }

    if (msg.type === 'team_result') {
      const runId = get().currentRunId;
      set((_s) => {
        let msgs = _s.messages;
        if (_s.streamingId) {
          msgs = _s.messages.map((m) => {
            if (m.id !== _s.streamingId) return m;
            return { ...m, thinkingDone: true } as any;
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
      _activeStreamMsgIds.delete(runId || '');
      return;
    }

    if (msg.type === 'thumbs') {
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === msg.msgId ? { ...m, thumbs: msg.value } : m,
        ),
      }));
    }
  };
}

function handleStreamStart(s: ChatState, msg: any, chunk: string): Partial<ChatState> {
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

function handleThinkingStreamNew(s: ChatState, msg: any, chunk: string): Partial<ChatState> {
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

function handleThinkingDone(s: ChatState, msg: any): Partial<ChatState> {
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