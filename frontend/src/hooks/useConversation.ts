import { useState, useEffect, useCallback } from 'react';
import type { Message, Conversation } from '../types/devagents';
import { getAgentResponse, getHomeResponse } from '../utils/agentResponses';
import { useSettings } from '../contexts/SettingsContext';

export function useConversation() {
  const { settings } = useSettings();
  const [agentMessages, setAgentMessages] = useState<Record<string, Message[]>>({
    'pm': [{ id: 1, role: 'agent', agentId: 'pm', content: '你好！我是产品经理，负责需求分析和产品规划。有什么产品需求可以告诉我。' }],
    'architect': [{ id: 2, role: 'agent', agentId: 'architect', content: '你好！我是架构师，负责系统架构设计和技术选型。有什么架构问题可以讨论。' }],
    'ui': [{ id: 3, role: 'agent', agentId: 'ui', content: '你好！我是 UI 设计师，负责界面与交互设计。有什么设计需求可以告诉我。' }],
    'frontend': [{ id: 4, role: 'agent', agentId: 'frontend', content: '你好！我是前端工程师，精通 React/Vue 开发。有什么前端需求可以告诉我。' }],
    'backend': [{ id: 5, role: 'agent', agentId: 'backend', content: '你好！我是后端工程师，负责 API 与数据库设计。有什么后端需求可以告诉我。' }],
    'qa': [{ id: 6, role: 'agent', agentId: 'qa', content: '你好！我是测试工程师，负责自动化与安全测试。有什么测试需求可以告诉我。' }],
    'devops': [{ id: 7, role: 'agent', agentId: 'devops', content: '你好！我是 DevOps 工程师，负责 CI/CD 和部署运维。有什么运维需求可以告诉我。' }],
    'fullstack': [{ id: 8, role: 'agent', agentId: 'fullstack', content: '你好！我是全栈工程师，可以处理前后端各种问题。有什么需求可以告诉我。' }]
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
      const typingMsg: Message = { id: typingId, role: 'agent', agentId: selectedAgentId, content: `${agentInfo?.name || 'Agent'} 正在思考...`, isTyping: true, timestamp: now };
      setTimeout(() => {
        setAgentMessages(prev => ({ ...prev, [selectedAgentId]: [...(prev[selectedAgentId] || []), typingMsg] }));
      }, 300);
      setTimeout(() => {
        const agentReply: Message = { id: now + 2, role: 'agent', agentId: selectedAgentId, content: getAgentResponse(selectedAgentId), timestamp: now + 2 };
        setAgentMessages(prev => ({ ...prev, [selectedAgentId]: [...(prev[selectedAgentId] || []).filter(m => m.id !== typingId), agentReply] }));
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
      const homeTypingMsg: Message = { id: homeTypingId, role: 'agent', agentId: 'pm', content: '需求分析助手 正在思考...', isTyping: true, timestamp: now };
      setTimeout(() => { setHomeMessages(prev => [...prev, homeTypingMsg]); }, 300);
      setTimeout(() => {
        const aiReply: Message = { id: now + 2, role: 'agent', agentId: 'pm', content: getHomeResponse(inputValue), timestamp: now + 2 };
        setHomeMessages(prev => [...prev.filter(m => m.id !== homeTypingId), aiReply]);
      }, 1000 + Math.random() * 1000);
    }
  }, [activeConvId]);

  return {
    agentMessages, setAgentMessages,
    homeMessages, setHomeMessages,
    activeConvId, setActiveConvId,
    conversations, setConversations,
    saveCurrentConversation,
    handleSendMessage,
  };
}
