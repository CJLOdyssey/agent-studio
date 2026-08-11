import { RefObject, useCallback } from 'react';
import { Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import type { Agent, Message } from '../../types/AgentStudio';
import TeamMessage from './TeamMessage';
import BrowserFrame from './BrowserFrame';
import { useChatStore } from '../../stores/chatStore';
import { editAndRegenerate, regenerateMessage, continueGeneration } from '../../stores/chatActions';

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
  onSwitchBranch: (runId: string) => void;
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
  onSwitchBranch,
}: Props) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const interruptedMessageId = useChatStore((s) => s.interruptedMessageId);
  const continuingId = useChatStore((s) => s.continuingId);
  const setThumbsFeedback = useChatStore((s) => s.setThumbsFeedback);
  const handleEditMessage = useCallback((msgId: string, newContent: string) => {
    // Edit → save content + regenerate the following answer (merged into its versions).
    void editAndRegenerate(msgId, newContent);
  }, []);

  const handleRegenerate = useCallback(
    (msgId: string) => {
      const idx = displayMessages.findIndex((m) => m.id === msgId);
      if (idx >= 0) {
        void regenerateMessage(idx);
      }
    },
    [displayMessages],
  );

  // 模型消息分页：同一用户问题的不同回答（重新生成链）也是分支（与用户
  // 消息 1:N）。切换 = 分支切换（父链 + 子孙链整体加载）：目标分支后续
  // 若有追问轮次，视图随之切到该分支的后续内容。目标 runId 由 store 计算。
  const handleSwitchAnswerVersion = useCallback(
    (msgId: string, direction: 'prev' | 'next') => {
      const runId = useChatStore
        .getState()
        .resolveAnswerVersionTarget(msgId, direction);
      if (!runId) return;
      void onSwitchBranch(runId);
    },
    [onSwitchBranch],
  );

  const handleSwitchUserVersion = useCallback(
    (msgId: string, direction: 'prev' | 'next') => {
      const runId = useChatStore
        .getState()
        .resolveUserVersionTarget(msgId, direction);
      if (!runId) return;
      // 用户版本 = 分支语义：始终整分支切换（视图加载目标分支全部消息）。
      void onSwitchBranch(runId);
    },
    [onSwitchBranch],
  );

  const handleThumbsFeedback = useCallback(
    (msgId: string, value: 'up' | 'down') => setThumbsFeedback(msgId, value),
    [setThumbsFeedback],
  );

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
                return a ? <a.icon size={32} className={a.color} /> : <Cpu size={32} />;
              })()}
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] m-0 mb-2">{t('agent.startChat', { name: allAgents.find((a) => a.id === selectedAgentId)?.name || '' })}</h3>
            <p className="text-base text-[var(--color-text-muted)] m-0">{t('agent.welcome')}</p>
          </div>
        )}
        {displayMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={reduce || msg.thinkingDone ? false : { opacity: 0, y: 12 }}
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
              onSwitchUserVersion={handleSwitchUserVersion}
              onSwitchAnswer={handleSwitchAnswerVersion}
              isContinuing={msg.id === continuingId}
              onThumbsFeedback={handleThumbsFeedback}
            />
          </motion.div>
        ))}
        <BrowserFrame />
        <div ref={messagesEndRef} />
      </div>
    );
  }

  if (hasMessages) {
    return (
      <div className="max-w-[min(900px,85vw)] mx-auto w-full flex flex-col gap-6 px-6 py-6 pb-12" aria-live="polite">
        {displayMessages.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          displayMessages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={reduce || msg.thinkingDone ? false : { opacity: 0, y: 12 }}
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
              onSwitchUserVersion={handleSwitchUserVersion}
              onSwitchAnswer={handleSwitchAnswerVersion}
              isContinuing={msg.id === continuingId}
              onThumbsFeedback={handleThumbsFeedback}
            />
          </motion.div>
          ))
        )}
        <BrowserFrame />
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return null;
}

function LoadingSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center py-24 text-sm text-[var(--color-text-muted)]"
      aria-busy="true"
    >
      <div className="h-4 w-40 mb-3 rounded bg-[var(--color-surface-raised)] animate-pulse" />
      <div className="h-4 w-56 rounded bg-[var(--color-surface-raised)] animate-pulse" />
      <div className="mt-4 text-[var(--color-text-muted)]">正在加载对话…</div>
    </div>
  );
}
