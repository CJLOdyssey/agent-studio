import { useState, useCallback, useEffect } from 'react';
import type { Conversation } from '../types/AgentStudio';
import { useChatStore } from '../stores/chatStore';
import { listSessions, deleteSession, renameSession, pinSession } from '../api/client/sessions';
import { useAuth } from '../components/auth';
import { useUserEvents } from './useUserEvents';
import type { UserEvent } from '../api/userEvents';
import Logger from '../utils/logger';

const uid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
const ACTIVE_CONV_KEY = 'agentstudio-active-conv-id';

/**
 * Conversation list manager — tracks saved conversations in localStorage.
 *
 * This hook handles ONLY conversation metadata (title, timestamps, persisted message list).
 * Actual message state is managed by chatStore (Zustand) which is the single source of
 * truth for real-time API/WebSocket messages.
 *
 * Mock fallback responses have been removed — see utils/agentResponses.ts for the
 * legacy mock system which is now only used when no API agents are configured.
 */
export function useConversation() {
  const { isAuthenticated } = useAuth();
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_CONV_KEY);
    } catch {
      return null;
    }
  });
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('agentstudio-conversations');
      if (!saved) return [];
      const convs = JSON.parse(saved);

      let needsPersist = false;
      for (const conv of convs) {
        if (!conv.messages?.length || !conv.createdAt || !conv.updatedAt) continue;
        const start = new Date(conv.createdAt).getTime();
        const end = new Date(conv.updatedAt).getTime();
        if (isNaN(start) || isNaN(end) || start >= end) continue;
        const total = conv.messages.length;
        for (let i = 0; i < total; i++) {
          const m = conv.messages[i];
          if (m.timestamp || m.created_at) continue;
          const estimated = start + (end - start) * ((i + 0.5) / total);
          m.created_at = new Date(estimated).toISOString();
          needsPersist = true;
        }
        const msgTimes = conv.messages
          .map((m: { created_at?: string }) => (m.created_at ? new Date(m.created_at).getTime() : null))
          .filter((t: number | null): t is number => t !== null);
        if (msgTimes.length > 0) {
          const lastMsgTime = Math.max(...msgTimes);
          const curUpdatedAt = new Date(conv.updatedAt).getTime();
          if (Math.abs(lastMsgTime - curUpdatedAt) > 3600000) {
            conv.updatedAt = new Date(lastMsgTime).toISOString();
            needsPersist = true;
          }
        }
      }

      if (needsPersist) {
        localStorage.setItem('agentstudio-conversations', JSON.stringify(convs));
      }

      return convs;
    } catch {
      return [];
    }
  });

  // Persist activeConvId across page refreshes
  useEffect(() => {
    try {
      if (activeConvId) {
        localStorage.setItem(ACTIVE_CONV_KEY, activeConvId);
      } else {
        localStorage.removeItem(ACTIVE_CONV_KEY);
      }
    } catch {
      // non-fatal
    }
  }, [activeConvId]);

  // Persist to localStorage whenever conversations change
  useEffect(() => {
    try {
      localStorage.setItem('agentstudio-conversations', JSON.stringify(conversations));
    } catch {
      // localStorage full or unavailable — non-fatal
    }
  }, [conversations]);

  // Listen for external writes (from chatStore sync)
  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('agentstudio-conversations');
        setConversations(saved ? JSON.parse(saved) : []);
      } catch { /* non-fatal */ }
    };
    window.addEventListener('agentstudio-conversations-updated', handler);
    return () => window.removeEventListener('agentstudio-conversations-updated', handler);
  }, []);

  // 退出登录：清空内存会话列表/激活会话（localStorage 已由 AuthContext 清），
  // 避免游客态仍显示登录用户的会话残留。
  useEffect(() => {
    const onLogout = () => {
      setConversations([]);
      setActiveConvId(null);
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  // Sessions are user-owned: only fetch once authentication is established,
  // and re-fetch when it flips (login/refresh completes after initial mount).
  // Matches ragbase's useQuery(enabled: isAuthenticated) semantics.
  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    listSessions(100).then((sessions) => {
      if (cancelled) return;
      setConversations((prev) => {
        const serverIds = new Set(sessions.map((s) => s.id));
        // 按 sessionId 去重（保留顺序最先 = 最新/带消息的记录），清掉历史遗留
        // 的重复（同 session 被乐观插入 + server 拉取各建一条）。
        const seenSessionIds = new Set<string>();
        const kept = prev.filter((c) => {
          if (!c.sessionId) return true;
          if (!serverIds.has(c.sessionId)) return false;
          if (seenSessionIds.has(c.sessionId)) return false;
          seenSessionIds.add(c.sessionId);
          return true;
        });
        const localIds = new Set(kept.map((c) => c.sessionId).filter(Boolean));
        const apiConvs: Conversation[] = [];
        for (const s of sessions) {
          if (localIds.has(s.id)) continue;
          apiConvs.push({
            id: crypto.randomUUID?.() || uid(),
            title: s.title,
            messages: [],
            kind: s.kind as 'normal' | 'agent' | 'team' || 'normal',
            agentId: s.agent_id || undefined,
            isPinned: s.is_pinned,
            runCount: s.run_count ?? 0,
            createdAt: s.created_at || new Date().toISOString(),
            updatedAt: s.updated_at || s.created_at || new Date().toISOString(),
            sessionId: s.id,
          });
        }
        if (apiConvs.length === 0 && kept.length === prev.length) return prev;
        const merged = [...apiConvs, ...kept];
        localStorage.setItem('agentstudio-conversations', JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  // 跨端实时同步：其他端对会话增删改 → 从服务器重建列表（DB 权威最终一致；
  // WS 重连触发全量对齐）。当前会话被其他端删除 → 清激活态。
  const refreshFromServer = useCallback(() => {
    listSessions(100).then((sessions) => {
      setConversations((prev) => {
        const seenSessionIds = new Set<string>();
        const merged = prev
          .filter((c) => !c.sessionId || sessions.some((x) => x.id === c.sessionId))
          .filter((c) => {
            if (!c.sessionId) return true;
            if (seenSessionIds.has(c.sessionId)) return false;
            seenSessionIds.add(c.sessionId);
            return true;
          })
          .map((c) => {
            const s = c.sessionId ? sessions.find((x) => x.id === c.sessionId) : undefined;
            return s
              ? {
                  ...c,
                  title: s.title,
                  isPinned: s.is_pinned,
                  runCount: s.run_count ?? 0,
                  updatedAt: s.updated_at || s.created_at || c.updatedAt,
                }
              : c;
          });
        for (const s of sessions) {
          if (merged.some((c) => c.sessionId === s.id)) continue;
          // 发送中的乐观 conv（无 sessionId、标题相同、15s 内创建）——它对应的
          // 后端 session 正是刚由 create run 创建的这条（WS session.updated 常
          // 先于 POST /api/runs 响应到达，refreshFromServer 抢先 push 会在链接
          // 前把同一 session 拉成第二条）。跳过 push，稍后
          // updateConversationSessionId 链接，消除"发送中侧边栏暂态双条"。
          const pendingSend = prev.some(
            (c) =>
              !c.sessionId &&
              c.title === s.title &&
              Date.now() - new Date(c.createdAt).getTime() < 15000,
          );
          if (pendingSend) continue;
          merged.push({
            id: crypto.randomUUID?.() || uid(),
            title: s.title,
            messages: [],
            kind: (s.kind as 'normal' | 'agent' | 'team') || 'normal',
            agentId: s.agent_id || undefined,
            isPinned: s.is_pinned,
            runCount: s.run_count ?? 0,
            createdAt: s.created_at || new Date().toISOString(),
            updatedAt: s.updated_at || s.created_at || new Date().toISOString(),
            sessionId: s.id,
          });
        }
        localStorage.setItem('agentstudio-conversations', JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {});
  }, []);

  useUserEvents(
    useCallback(
      (event: UserEvent) => {
        if (event.type === 'session.deleted') {
          const target = conversations.find((c) => c.sessionId === event.session_id);
          if (target && target.id === activeConvId) {
            setActiveConvId(null);
          }
        }
        refreshFromServer();
      },
      [conversations, activeConvId, refreshFromServer],
    ),
    useCallback(() => {
      refreshFromServer();
    }, [refreshFromServer]),
  );

  /** Persist conversations to localStorage immediately (not just via the debounced effect). */
  const persistConversations = useCallback((convs: Conversation[]) => {
    try {
      localStorage.setItem('agentstudio-conversations', JSON.stringify(convs));
    } catch {
      // non-fatal
    }
  }, []);

  /** Save or update a conversation. If convId exists, updates it; otherwise creates new. */
  const saveConversation = useCallback((title: string, messages: unknown[], agentId?: string, teamId?: string, teamName?: string, kind?: 'normal' | 'agent' | 'team') => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID?.() || uid();
    const conv: Conversation = {
      id,
      title: title.length > 36 ? title.slice(0, 36) + '...' : title,
      messages: messages as Conversation['messages'],
      createdAt: now,
      updatedAt: now,
      kind,
      agentId,
      teamId,
      teamName,
    };
    setConversations((prev) => {
      const next = [conv, ...prev];
      persistConversations(next);
      return next;
    });
    setActiveConvId(id);
    return id;
  }, [persistConversations]);

  /** Update messages for an existing conversation. */
  const updateConversationMessages = useCallback((convId: string, messages: unknown[], updateTimestamps = true, teamId?: string, teamName?: string) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === convId
          ? { ...c, messages: messages as Conversation['messages'], ...(updateTimestamps ? { updatedAt: new Date().toISOString() } : {}), ...(teamId !== undefined ? { teamId } : {}), ...(teamName !== undefined ? { teamName } : {}) }
          : c,
      );
      persistConversations(next);
      return next;
    });
  }, [persistConversations]);

  /** Update session ID for an existing conversation (links to backend session). */
  const updateConversationSessionId = useCallback((convId: string, sessionId: string, updateTimestamps = true) => {
    setConversations((prev) => {
      // 去重（发消息"显示两个会话"根治）：乐观 conv 在 WS 触发的
      // refreshFromServer 时尚未有 sessionId（去重 :180 失配），server 会把
      // 同一后端 session 拉成另一条空记录；此刻链接 sessionId 时删除该重复，
      // 保留带消息的当前 conv（其 id 即 activeConvId / URL）。
      const next = prev
        .filter((c) => !(c.sessionId === sessionId && c.id !== convId))
        .map((c) =>
          c.id === convId ? { ...c, sessionId, ...(updateTimestamps ? { updatedAt: new Date().toISOString() } : {}) } : c,
        );
      persistConversations(next);
      return next;
    });
  }, [persistConversations]);

  /** Delete a conversation by ID — removes the local record AND the server session. */
  const deleteConversation = useCallback((convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      persistConversations(next);
      return next;
    });
    setActiveConvId((current) => {
      if (current === convId) {
        useChatStore.getState().reset();
        return null;
      }
      return current;
    });
    if (conv?.sessionId) {
      deleteSession(conv.sessionId).catch((err) => {
        Logger.warn('[conversation] failed to delete server session %s: %s', conv.sessionId, String(err));
        // 乐观删除失败 → 以 server 为准恢复（DB 权威）
        refreshFromServer();
      });
    }
  }, [conversations, persistConversations, refreshFromServer]);

  /** Rename a conversation — optimistic localStorage update + server sync. */
  const renameConversation = useCallback((convId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const conv = conversations.find((c) => c.id === convId);
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === convId ? { ...c, title: trimmed } : c,
      );
      persistConversations(next);
      return next;
    });
    if (conv?.sessionId) {
      renameSession(conv.sessionId, trimmed).catch((err) => {
        Logger.warn('[conversation] failed to rename session %s: %s', conv.sessionId, String(err));
        // 乐观重命名失败 → 以 server 为准恢复标题（DB 权威）
        refreshFromServer();
      });
    }
  }, [conversations, persistConversations, refreshFromServer]);

  /** Pin/unpin a conversation — optimistic localStorage update + server sync. */
  const pinConversation = useCallback((convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    const next = !conv?.isPinned;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === convId ? { ...c, isPinned: next } : c,
      );
      persistConversations(updated);
      return updated;
    });
    if (conv?.sessionId) {
      pinSession(conv.sessionId, next).catch((err) => {
        Logger.warn('[conversation] failed to pin session %s: %s', conv.sessionId, String(err));
        // 乐观置顶失败 → 以 server 为准恢复（DB 权威）
        refreshFromServer();
      });
    }
  }, [conversations, persistConversations, refreshFromServer]);

  return {
    activeConvId,
    setActiveConvId,
    conversations,
    setConversations,
    saveConversation,
    updateConversationMessages,
    updateConversationSessionId,
    deleteConversation,
    renameConversation,
    pinConversation,
  };
}
