import { useState, useCallback, useEffect } from 'react';
import type { Conversation } from '../types/AgentStudio';
import type { SessionItem } from '../types';
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
  // 会话列表是否已从 server 加载完成（首个 listSessions 成功）。
  // useWorkstationState 据此判定"URL 指向的会话是否真的不存在"（避免初始
  // 加载竞态把尚在拉取的会话误判为已删除而跳回首页）。
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
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

  // Persist conversations to localStorage immediately (not just via the debounced effect).
  // 乐观占位（temp）不落盘：刷新后以 server 为准，未获确认的占位直接丢弃。
  const persistConversations = useCallback((convs: Conversation[]) => {
    try {
      localStorage.setItem(
        'agentstudio-conversations',
        JSON.stringify(convs.filter((c) => !c.temp)),
      );
    } catch {
      // non-fatal
    }
  }, []);

  // 正式模式的统一列表归并（幂等核心，替代此前的 merge+删重补丁）：
  // 乐观占位（temp）保留在列；已确认会话与 server 按 sessionId 合并（唯一）；
  // server 新会话若匹配 temp 占位（同标题 + 15s 内创建）则原位替换（不新增，
  // 消除 WS 事件先于 run 响应的发送中暂态双条）；已确认但不在 server 的删除。
  const mergeWithServer = useCallback((prev: Conversation[], sessions: SessionItem[]) => {
    const confirmed = new Map<string, Conversation>();
    const temp: Conversation[] = [];
    const orphan: Conversation[] = [];
    for (const c of prev) {
      if (c.temp) {
        temp.push(c);
        continue;
      }
      if (c.sessionId) {
        confirmed.set(c.sessionId, c);
        continue;
      }
      // 无 sessionId 且非 temp：本地旧数据/未确认会话——保留（server 无对应）
      orphan.push(c);
    }
    const matchesTemp = (t: Conversation, s: SessionItem) =>
      t.title === s.title &&
      Date.now() - new Date(t.createdAt).getTime() < 15000;
    const result: Conversation[] = [
      ...orphan,
      ...temp.filter((t) => !sessions.some((s) => matchesTemp(t, s))),
    ];
    for (const s of sessions) {
      const local = confirmed.get(s.id);
      const tmp = temp.find((t) => matchesTemp(t, s));
      if (tmp && !local) {
        // WS 事件先于 run 响应到达：server 条目匹配到发送中的乐观占位。
        // 原位「吸附」到 server 会话但保留 temp 语义（temp:true + 原 id）——
        // 加载/兜底 effect 据 temp 标记放行进行中的流式状态；等 run 响应
        // 的 confirm effect 再转正（id→sessionId）。不新增重复条。
        result.push({
          ...tmp,
          sessionId: s.id,
          title: s.title,
          isPinned: s.is_pinned,
          runCount: s.run_count ?? 0,
          createdAt: s.created_at || tmp.createdAt,
          updatedAt: s.updated_at || s.created_at || tmp.updatedAt,
          agentId: s.agent_id || tmp.agentId,
        });
        continue;
      }
      result.push({
        id: s.id,
        sessionId: s.id,
        title: s.title,
        messages: local?.messages ?? tmp?.messages ?? [],
        kind: (s.kind as 'normal' | 'agent' | 'team') || 'normal',
        agentId: s.agent_id || local?.agentId || tmp?.agentId,
        isPinned: s.is_pinned,
        runCount: s.run_count ?? 0,
        createdAt:
          s.created_at || local?.createdAt || tmp?.createdAt || new Date().toISOString(),
        updatedAt:
          s.updated_at || s.created_at || local?.updatedAt || tmp?.updatedAt ||
          new Date().toISOString(),
        teamId: local?.teamId ?? tmp?.teamId,
        teamName: local?.teamName ?? tmp?.teamName,
      });
    }
    return result;
  }, []);

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

  // Persist to localStorage whenever conversations change (temp 占位不落盘)
  useEffect(() => {
    try {
      localStorage.setItem(
        'agentstudio-conversations',
        JSON.stringify(conversations.filter((c) => !c.temp)),
      );
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
      setSessionsLoaded(false);
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
      setSessionsLoaded(true);
      setConversations((prev) => {
        const merged = mergeWithServer(prev, sessions);
        if (merged.length === prev.length) return prev;
        persistConversations(merged.filter((c) => !c.temp));
        return merged;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, mergeWithServer, persistConversations]);

  // 跨端实时同步：其他端对会话增删改 → 从服务器重建列表（DB 权威最终一致；
  // WS 重连触发全量对齐）。当前会话被其他端删除 → 清激活态。
  const refreshFromServer = useCallback(() => {
    listSessions(100).then((sessions) => {
      setConversations((prev) => {
        const merged = mergeWithServer(prev, sessions);
        persistConversations(merged.filter((c) => !c.temp));
        return merged;
      });
    }).catch(() => {});
  }, [mergeWithServer, persistConversations]);

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

  /** Save or update a conversation. If convId exists, updates it; otherwise creates new.
   * 正式模式：发送时创建乐观占位（id=temp-*，temp:true，不持久化），server 确认
   * （run 响应返回 session_id）后经 confirmConversationSession 原位替换为 sessionId。
   */
  const saveConversation = useCallback((title: string, messages: unknown[], agentId?: string, teamId?: string, teamName?: string, kind?: 'normal' | 'agent' | 'team') => {
    const now = new Date().toISOString();
    const id = `temp-${crypto.randomUUID?.() || uid()}`;
    const conv: Conversation = {
      id,
      temp: true,
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

  /** 正式模式：server 确认后把乐观占位原位替换为真实会话（id → sessionId）。
   * 顺带唯一化：同 sessionId 只保留一条（保留顺序最先 = 本地带消息的占位，
   * 删除 WS 先到被 merge push 的空 server 条）——结构幂等，非删重补丁。 */
  const confirmConversationSession = useCallback((tempId: string, sessionId: string) => {
    setConversations((prev) => {
      const replaced = prev.map((c) => {
        if (c.id !== tempId) return c;
        if (c.temp) {
          // 乐观占位：原位替换 id → sessionId（正式会话标识）
          const { temp: _removed, ...rest } = c;
          return { ...rest, id: sessionId, sessionId };
        }
        // 续聊/已确认会话（非占位）：仅补/更新 sessionId，保留本地 id
        return { ...c, sessionId };
      });
      const seen = new Set<string>();
      const unique = replaced.filter((c) => {
        const key = c.temp ? c.id : c.sessionId || c.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      persistConversations(unique);
      return unique;
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
    sessionsLoaded,
    saveConversation,
    updateConversationMessages,
    confirmConversationSession,
    deleteConversation,
    renameConversation,
    pinConversation,
  };
}
