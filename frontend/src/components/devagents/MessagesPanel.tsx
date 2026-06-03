import { RefObject } from 'react';
import { Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Agent, Message } from '../../types/devagents';
import TeamMessage from './TeamMessage';

interface Props {
  showAgentChat: boolean;
  hasMessages: boolean;
  selectedAgentId: string | null;
  welcomeDismissed: boolean;
  allAgents: Agent[];
  displayMessages: Message[];
  messagesEndRef: RefObject<HTMLDivElement>;
  onDismissWelcome: () => void;
}

export default function MessagesPanel({
  showAgentChat, hasMessages, selectedAgentId, welcomeDismissed,
  allAgents, displayMessages, messagesEndRef, onDismissWelcome,
}: Props) {
  const { t } = useTranslation();

  if (showAgentChat) {
    return (
      <div className="devagents-messages-inner" aria-live="polite">
        {!welcomeDismissed && (
          <div className="devagents-agent-welcome">
            <button className="devagents-welcome-close" onClick={onDismissWelcome} aria-label={t('common.close')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div className="devagents-agent-welcome-icon">
              {(() => { const a = allAgents.find(x => x.id === selectedAgentId); return a ? <a.icon size={32} className={a.color} /> : <Bot size={32} />; })()}
            </div>
            <h3>{t('agent.startChat', { name: allAgents.find(a => a.id === selectedAgentId)?.name || '' })}</h3>
            <p>{t('agent.welcome')}</p>
          </div>
        )}
        {displayMessages.map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={allAgents} />)}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  if (hasMessages) {
    return (
      <div className="devagents-messages-inner" aria-live="polite">
        {displayMessages.map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={allAgents} />)}
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return null;
}
