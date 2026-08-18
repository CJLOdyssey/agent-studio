import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '../../stores/chatStore';
import type { useConversation } from '../../hooks/useConversation';

type ConversationReturn = ReturnType<typeof useConversation>;

export interface WorkspaceNavigationDeps {
  conv: ConversationReturn;
  syncActiveConversation: () => void;
  resetApi: () => void;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedModelState: (id: string) => void;
  setRestoring: (v: boolean) => void;
  setConversationKey: (fn: (prev: number) => number) => void;
  navigate: (path: string, opts?: { replace?: boolean }) => void;
  buildConvPath: (conv: { id: string; kind?: string; teamId?: string | null; agentId?: string | null }) => string;
}

export function useWorkspaceNavigation(deps: WorkspaceNavigationDeps) {
  const {
    conv, syncActiveConversation, resetApi, setSelectedAgentId,
    setSelectedModelState, setRestoring, setConversationKey,
    navigate, buildConvPath,
  } = deps;

  const handleNewChat = useCallback(() => {
    syncActiveConversation();
    resetApi();
    setSelectedAgentId(null);
    useChatStore.getState().setActiveTeam(null);
    conv.setActiveConvId(null);
    setRestoring(false);
    navigate('/');
    setConversationKey((prev) => prev + 1);
  }, [syncActiveConversation, conv, resetApi, navigate]);

  const navigateToConversation = useCallback((convId: string | null) => {
    const target = convId ? conv.conversations.find((c: { id: string }) => c.id === convId) : undefined;
    if (target) {
      const teamId = target.kind === 'team' ? target.teamId : undefined;
      const agentId = target.kind === 'agent' ? target.agentId : undefined;
      useChatStore.getState().setActiveTeam(teamId ?? null);
      setSelectedAgentId(agentId ?? null);
    }
    conv.setActiveConvId(convId);
    if (convId) {
      setRestoring(true);
      navigate(buildConvPath(target ?? { id: convId }));
    } else {
      setRestoring(false);
      navigate('/');
    }
  }, [conv, navigate, setSelectedAgentId, buildConvPath]);

  // Last chat restore
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem('agentstudio-active-conv-id'); } catch { /* non-fatal */ }
    const { sessionId, agentId, teamId } = (() => {
      try {
        const params = new URL(window.location.href).pathname.split('/');
        return { sessionId: params[3], agentId: params[2] === 'agent' ? params[2] : undefined, teamId: params[2] === 'team' ? params[2] : undefined };
      } catch { return { sessionId: undefined, agentId: undefined, teamId: undefined }; }
    })();
    if (!sessionId && !agentId && !teamId && stored) {
      navigate(`/chat/${stored}`, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logout handler
  const queryClient = useQueryClient();
  useEffect(() => {
    const onLogout = () => {
      setSelectedModelState('');
      queryClient.removeQueries({ queryKey: ['models'] });
      queryClient.removeQueries({ queryKey: ['keys'] });
      navigate('/');
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [queryClient, navigate]);

  return { handleNewChat, navigateToConversation };
}
