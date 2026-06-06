import { useState } from 'react';
import { Bot } from 'lucide-react';
import type { Agent } from '../../types/devagents';
import { useTranslation } from 'react-i18next';

interface Props {
  agent: Agent | undefined;
}

export default function AgentWelcome({ agent }: Props) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="devagents-agent-welcome">
      <button className="devagents-welcome-close" onClick={() => setDismissed(true)} aria-label={t('common.close')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="devagents-agent-welcome-icon">
        {agent ? <agent.icon size={32} className={agent.color} /> : <Bot size={32} />}
      </div>
      <h3>{t('agent.startChat', { name: agent?.name || '' })}</h3>
      <p>{t('agent.welcome')}</p>
    </div>
  );
}
