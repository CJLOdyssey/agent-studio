import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Message, Conversation } from '../types/devagents';
import { getAgentResponse, getHomeResponse, getAgentGreeting } from '../utils/agentResponses';
import { useSettings } from '../contexts/SettingsContext';

const AGENT_IDS = ['pm', 'architect', 'ui', 'frontend', 'backend', 'qa', 'devops', 'fullstack'] as const;

export function useConversation() {
  const { settings } = useSettings();
  const { t } = useTranslation();

  const [agentMessages, setAgentMessages] = useState<Record<string, Message[]>>(() => {
    const initial: Record<string, Message[]> = {};
    for (const id of AGENT_IDS) {
      initial[id] = [
        { id: AGENT_IDS.indexOf(id) + 1, role: 'agent', agentId: id, content: getAgentGreeting(id, t) },
      ];
    }
    return initial;
  });

  const [homeMessages, setHomeMessages] = useState<Message[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('devagents-conversations');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (settings.autoSave) {
      localStorage.setItem('devagents-conversations', JSON.stringify(conversations));
    }
  }, [conversations, settings.autoSave]);

  useEffect(() => {
    if (homeMessages.length === 0 || activeConvId === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(prev => prev.map(c =>
      c.id === activeConvId
        ? { ...c, messages: homeMessages, updatedAt: new Date().toISOString() }
        : c
    ));
  }, [homeMessages, activeConvId, setConversations]);

  const saveCurrentConversation = useCallback(() => {
    if (homeMessages.length > 0 && activeConvId) {
      setConversations(prev => prev.map(c =>
        c.id === activeConvId
          ? { ...c, messages: homeMessages, updatedAt: new Date().toISOString() }
          : c
      ));
    }
  }, [homeMessages, activeConvId]);

  const handleSendMessage = useCallback((inputValue: string, selectedAgentId: string | null, allAgents: { id: string; name: string }[]) => {
    if (!inputValue.trim()) return;
    const now = Date.now();
    const newUserMsg: Message = { id: now, role: 'user', content: inputValue, timestamp: now };

    if (selectedAgentId) {
      setAgentMessages(prev => ({
        ...prev,
        [selectedAgentId]: [...(prev[selectedAgentId] || []), newUserMsg]
      }));
      const typingId = now + 1;
      const agentInfo = allAgents.find(a => a.id === selectedAgentId);
      const typingMsg: Message = {
        id: typingId,
        role: 'agent',
        agentId: selectedAgentId,
        content: t('agent.thinking', { name: agentInfo?.name || 'Agent' }),
        isTyping: true,
        timestamp: now,
      };
      setTimeout(() => {
        setAgentMessages(prev => ({ ...prev, [selectedAgentId]: [...(prev[selectedAgentId] || []), typingMsg] }));
      }, 300);
      setTimeout(() => {
        const agentReply: Message = {
          id: now + 2,
          role: 'agent',
          agentId: selectedAgentId,
          content: getAgentResponse(selectedAgentId, t),
          timestamp: now + 2,
        };
        setAgentMessages(prev => ({
          ...prev,
          [selectedAgentId]: [...(prev[selectedAgentId] || []).filter(m => m.id !== typingId), agentReply],
        }));
      }, 1000 + Math.random() * 1000);
    } else {
      let convId = activeConvId;
      if (!convId) {
        convId = Date.now();
        const title = inputValue.length > 36 ? inputValue.slice(0, 36) + '...' : inputValue;
        const newConv: Conversation = { id: convId, title, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        setConversations(prev => [newConv, ...prev]);
        setActiveConvId(convId);
      }
      setHomeMessages(prev => [...prev, newUserMsg]);
      const homeTypingId = now + 1;
      const homeTypingMsg: Message = {
        id: homeTypingId,
        role: 'agent',
        agentId: 'pm',
        content: t('agent.thinking', { name: '需求分析助手' }),
        isTyping: true,
        timestamp: now,
      };
      setTimeout(() => { setHomeMessages(prev => [...prev, homeTypingMsg]); }, 300);
      setTimeout(() => {
        const aiReply: Message = {
          id: now + 2,
          role: 'agent',
          agentId: 'pm',
          content: getHomeResponse(inputValue, t),
          timestamp: now + 2,
        };
        setHomeMessages(prev => [...prev.filter(m => m.id !== homeTypingId), aiReply]);
      }, 1000 + Math.random() * 1000);
    }
  }, [activeConvId, t]);

  return {
    agentMessages, setAgentMessages,
    homeMessages, setHomeMessages,
    activeConvId, setActiveConvId,
    conversations, setConversations,
    saveCurrentConversation,
    handleSendMessage,
  };
}
