import { useState, useCallback, useEffect } from 'react';
import type { Conversation } from '../types/devagents';
import { useChatStore } from '../stores/chatStore';

const uid = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10);

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
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('devagents-conversations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever conversations change
  useEffect(() => {
    try {
      localStorage.setItem('devagents-conversations', JSON.stringify(conversations));
    } catch {
      // localStorage full or unavailable — non-fatal
    }
  }, [conversations]);

  // Listen for external writes (from chatStore sync)
  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('devagents-conversations');
        if (saved) setConversations(JSON.parse(saved));
      } catch { /* non-fatal */ }
    };
    window.addEventListener('devagents-conversations-updated', handler);
    return () => window.removeEventListener('devagents-conversations-updated', handler);
  }, []);

  /** Save or update a conversation. If convId exists, updates it; otherwise creates new. */
  const saveConversation = useCallback((title: string, messages: unknown[], agentId?: string) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID?.() || uid();
    const conv: Conversation = {
      id,
      title: title.length > 36 ? title.slice(0, 36) + '...' : title,
      messages: messages as Conversation['messages'],
      createdAt: now,
      updatedAt: now,
      agentId,
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(id);
    return id;
  }, []);

  /** Update messages for an existing conversation. */
  const updateConversationMessages = useCallback((convId: string, messages: unknown[]) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: messages as Conversation['messages'], updatedAt: new Date().toISOString() }
          : c,
      ),
    );
  }, []);

  /** Update session ID for an existing conversation (links to backend session). */
  const updateConversationSessionId = useCallback((convId: string, sessionId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, sessionId, updatedAt: new Date().toISOString() } : c,
      ),
    );
  }, []);

  /** Delete a conversation by ID. */
  const deleteConversation = useCallback((convId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    setActiveConvId((current) => {
      if (current === convId) {
        useChatStore.getState().reset();
        return null;
      }
      return current;
    });
  }, []);

  return {
    activeConvId,
    setActiveConvId,
    conversations,
    setConversations,
    saveConversation,
    updateConversationMessages,
    updateConversationSessionId,
    deleteConversation,
  };
}
