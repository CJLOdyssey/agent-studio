import { useCallback } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { submitRequirement } from '../../stores/chatActions';
import Logger from '../../utils/logger';
import type { AttachedFile } from '../input';
import type { useConversation } from '../../hooks/useConversation';

type ConversationReturn = ReturnType<typeof useConversation>;

export interface MessageHandlerDeps {
  conv: ConversationReturn;
  selectedAgentId: string | null;
  activeTeamId: string | null | undefined;
  activeTeamName: string | undefined;
  ensureModelPersisted: () => void;
  navigate: (path: string) => void;
  buildConvPath: (conv: { id: string; kind?: string; teamId?: string | null; agentId?: string | null }) => string;
  runConvIdRef: React.MutableRefObject<string | null>;
  pendingTempIdRef: React.MutableRefObject<string | null>;
  teamMgmtTeams: { id: string; name?: string }[];
  notify: () => void;
  attachmentIdsOf: (files: AttachedFile[]) => string[] | undefined;
}

export function useMessageHandlers(deps: MessageHandlerDeps) {
  const {
    conv, selectedAgentId, activeTeamId, activeTeamName,
    ensureModelPersisted, navigate, buildConvPath,
    runConvIdRef, pendingTempIdRef, teamMgmtTeams,
    notify, attachmentIdsOf,
  } = deps;

  const handleSendMessage = useCallback(
    async (text: string, files: AttachedFile[]) => {
      ensureModelPersisted();
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachments: files
          .filter((f) => f.attachmentId)
          .map((f) => ({ id: f.attachmentId as string, filename: f.name, size_bytes: f.size })),
      };
      const activeConv = conv.activeConvId
        ? conv.conversations.find((c: { id: string }) => c.id === conv.activeConvId)
        : undefined;
      if (!conv.activeConvId) {
        const tName = teamMgmtTeams.find(t => t.id === activeTeamId)?.name;
        const kind: 'agent' | 'team' | 'normal' = selectedAgentId ? 'agent' : activeTeamId ? 'team' : 'normal';
        const convId = conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined, activeTeamId ?? undefined, tName, kind);
        if (convId) {
          conv.setActiveConvId(convId);
          runConvIdRef.current = convId;
          pendingTempIdRef.current = convId;
          useChatStore.setState({
            currentConvId: convId,
            messages: [{
              id: userMessage.id, role: userMessage.role, agent_name: '我',
              content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
            }],
          });
          navigate(buildConvPath({ id: convId, kind, teamId: activeTeamId, agentId: selectedAgentId }));
        }
      } else {
        runConvIdRef.current = conv.activeConvId;
        const prevMessages = activeConv?.messages ?? [];
        conv.updateConversationMessages(conv.activeConvId, [...prevMessages, userMessage], true, activeTeamId ?? undefined, activeTeamName);
        const st = useChatStore.getState();
        useChatStore.setState({ messages: [...st.messages, {
          id: userMessage.id, role: userMessage.role, agent_name: '我',
          content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
        }] });
      }
      window.dispatchEvent(new CustomEvent('clear-browser-url'));
      const submitAgentId = activeConv?.kind === 'agent'
        ? (activeConv.agentId ?? selectedAgentId ?? undefined)
        : selectedAgentId ?? undefined;
      submitRequirement(text, undefined, submitAgentId, true, undefined, undefined, undefined, attachmentIdsOf(files)).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [submitRequirement, selectedAgentId, notify, conv, activeTeamId, activeTeamName, teamMgmtTeams, navigate, attachmentIdsOf, ensureModelPersisted, buildConvPath],
  );

  const handleHomeSend = useCallback(
    async (text: string, files: AttachedFile[]) => {
      ensureModelPersisted();
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachments: files
          .filter((f) => f.attachmentId)
          .map((f) => ({ id: f.attachmentId as string, filename: f.name, size_bytes: f.size })),
      };
      const homeKind: 'agent' | 'team' | 'normal' = selectedAgentId ? 'agent' : 'normal';
      if (!conv.activeConvId) {
        const convId = conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined, undefined, undefined, homeKind);
        if (convId) {
          conv.setActiveConvId(convId);
          runConvIdRef.current = convId;
          pendingTempIdRef.current = convId;
          useChatStore.setState({
            currentConvId: convId,
            messages: [{
              id: userMessage.id, role: userMessage.role, agent_name: '我',
              content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
            }],
          });
          navigate(`/chat/${convId}`);
        }
      } else {
        runConvIdRef.current = conv.activeConvId;
        const activeConv = conv.conversations.find((c: { id: string }) => c.id === conv.activeConvId);
        const prevMessages = activeConv?.messages ?? [];
        conv.updateConversationMessages(conv.activeConvId, [...prevMessages, userMessage], true);
        const st = useChatStore.getState();
        useChatStore.setState({ messages: [...st.messages, {
          id: userMessage.id, role: userMessage.role, agent_name: '我',
          content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
        }] });
      }
      submitRequirement(text, undefined, undefined, true, undefined, undefined, undefined, attachmentIdsOf(files)).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [conv, submitRequirement, notify, selectedAgentId, navigate, attachmentIdsOf, ensureModelPersisted],
  );

  return { handleSendMessage, handleHomeSend };
}
