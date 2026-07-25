import { RefObject } from 'react';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import type { Agent, Message } from '../../types/AgentStudio';
import TeamMessage from './TeamMessage';
import { useChatStore } from '../../stores/chatStore';
import { editMessage, regenerateMessage, continueGeneration } from '../../stores/chatActions';

interface Props {
  showAgentChat: boolean;
  hasMessages: boolean;
  selectedAgentId: string | null;
  activeTeamId?: string | null;
  welcomeDismissed: boolean;
  allAgents: Agent[];
  displayMessages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  onDismissWelcome: () => void;
}

export default function MessagesPanel({
  showAgentChat,
  hasMessages,
  selectedAgentId,
  activeTeamId,
  welcomeDismissed,
  allAgents,
  displayMessages,
  messagesEndRef,
  onDismissWelcome,
}: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const interruptedMessageId = useChatStore((s) => s.interruptedMessageId);
  const switchVersion = useChatStore((s) => s.switchVersion);
  const continuingId = useChatStore((s) => s.continuingId);
  const setThumbsFeedback = useChatStore((s) => s.setThumbsFeedback);
  const handleEditMessage = (msgId: string, newContent: string) => {
    const idx = displayMessages.findIndex((m) => m.id === msgId);
    if (idx >= 0) {
      editMessage(idx, newContent);
      // 编辑用户消息后自动重新生成 AI 回复
      const msg = displayMessages[idx];
      if (msg.role === 'user' && idx + 1 < displayMessages.length) {
        const aiMsg = displayMessages[idx + 1];
        if (aiMsg.role === 'agent') {
          regenerateMessage(idx + 1);
        }
      }
    }
  };

  const handleRegenerate = (msgId: string) => {
    const idx = displayMessages.findIndex((m) => m.id === msgId);
    if (idx >= 0) {
      regenerateMessage(idx);
    }
  };

  const handleSwitchVersion = (msgId: string, direction: 'prev' | 'next') => {
    switchVersion(msgId, direction);
  };

  const handleThumbsFeedback = (msgId: string, value: 'up' | 'down') => {
    setThumbsFeedback(msgId, value);
  };

  if (showAgentChat) {
    return (
      <div className="max-w-[min(900px,85vw)] mx-auto w-full flex flex-col gap-6 px-6 py-6 pb-12" aria-live="polite">
        {!welcomeDismissed && !activeTeamId && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center relative">
            <button className="absolute top-2 right-2 p-1 bg-transparent border-none rounded text-[var(--color-text-muted)] cursor-pointer opacity-0 transition-opacity group-hover:opacity-100" onClick={onDismissWelcome} aria-label={t('common.close')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="w-14 h-14 rounded-[14px] flex items-center justify-center bg-[var(--color-surface-raised)] mb-4">
              {(() => {
                const a = allAgents.find((x) => x.id === selectedAgentId);
                return a ? <a.icon size={32} className={a.color} /> : <Bot size={32} />;
              })()}
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] m-0 mb-2">{t('agent.startChat', { name: allAgents.find((a) => a.id === selectedAgentId)?.name || '' })}</h3>
            <p className="text-base text-[var(--color-text-muted)] m-0">{t('agent.welcome')}</p>
          </div>
        )}
        {displayMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <TeamMessage
              msg={msg}
              allAgents={allAgents}
              onEditMessage={handleEditMessage}
              onRegenerate={handleRegenerate}
              showContinue={msg.id === interruptedMessageId}
              onContinue={continueGeneration}
              onSwitchVersion={handleSwitchVersion}
              isContinuing={msg.id === continuingId}
              onThumbsFeedback={handleThumbsFeedback}
            />
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  if (hasMessages) {
    return (
      <div className="max-w-[min(900px,85vw)] mx-auto w-full flex flex-col gap-6 px-6 py-6 pb-12" aria-live="polite">
        {displayMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <TeamMessage
              msg={msg}
              allAgents={allAgents}
              onEditMessage={handleEditMessage}
              onRegenerate={handleRegenerate}
              showContinue={msg.id === interruptedMessageId}
              onContinue={continueGeneration}
              onSwitchVersion={handleSwitchVersion}
              isContinuing={msg.id === continuingId}
              onThumbsFeedback={handleThumbsFeedback}
            />
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return null;
}
