import { useState, memo } from 'react';
import {
  Bot, User, Code2, Terminal, ChevronRight, ChevronDown,
  CheckCircle2, Loader2, Copy, Check
} from 'lucide-react';
import type { Message, Agent } from '../../types/devagents';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useTranslation } from 'react-i18next';
import { sanitizeHtml } from '../../utils/sanitize';

const TeamMessage = memo(function TeamMessage({ msg, allAgents }: { msg: Message; allAgents: Agent[] }) {
  const { t, i18n } = useTranslation();
  const isUser = msg.role === 'user';
  const [isProcessExpanded, setIsProcessExpanded] = useState(true);
  const { copied, copy: handleCopy } = useCopyToClipboard();

  if (isUser) {
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <div className="devagents-message devagents-message-user">
        <div className="devagents-message-avatar user">
          <User size={16} />
        </div>
        <div className="devagents-message-content-wrapper user">
           <span className="devagents-message-label">{t('teamMessage.you')}</span>
           <div className="devagents-message-bubble user">
              {sanitizeHtml(msg.content)}
           </div>
      <div className="devagents-message-actions">
                <button className="devagents-msg-copy" onClick={() => { handleCopy(msg.content); }} title={t('teamMessage.copy')} aria-label={t('teamMessage.copy')}>
                 {copied ? <Check size={12} /> : <Copy size={12} />}
               </button>
              {time && <span className="devagents-message-time">{time}</span>}
             </div>
        </div>
      </div>
    );
  }

  const agentInfo = allAgents.find(a => a.id === msg.agentId) || {
    name: t('teamMessage.unknownAgent'),
    role: t('teamMessage.system'),
    icon: Bot,
    color: 'text-[var(--da-text-muted)]',
    bg: 'bg-[var(--da-bg-surface)]',
    border: 'border-[var(--da-border)]'
  };
  const Icon = agentInfo.icon;
  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="devagents-message devagents-message-agent">
      <div className={`devagents-message-avatar agent ${agentInfo.bg} ${agentInfo.border}`}>
        <Icon size={16} className={agentInfo.color} />
      </div>
      <div className="devagents-message-content-wrapper agent">
        <div className="devagents-message-header">
          <span className={`devagents-message-name ${agentInfo.color}`}>{agentInfo.name}</span>
          <span className="devagents-message-role">{agentInfo.role}</span>
        </div>

        {msg.isTyping ? (
          <div className="devagents-message-typing">
             <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
             <span>{t('agent.thinking', { name: agentInfo.name })}</span>
          </div>
        ) : (
          <>
            {msg.plan && (
              <div className="devagents-process-panel">
                <div
                  className="devagents-process-header"
                  onClick={() => setIsProcessExpanded(!isProcessExpanded)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isProcessExpanded}
                  aria-controls="process-steps"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsProcessExpanded(!isProcessExpanded); } }}
                >
                  <div className="devagents-process-title">
                    <Terminal size={12} className={agentInfo.color} />
                    {t('teamMessage.executeTask', { count: String(msg.plan.length) })}
                  </div>
                  {isProcessExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>

                {isProcessExpanded && (
                  <div className="devagents-process-steps" id="process-steps">
                    {msg.plan.map((step) => (
                      <div key={step.step} className="devagents-process-step">
                        {step.status === 'completed' ? (
                          <CheckCircle2 size={14} className="text-[var(--icon-status-success)]" />
                        ) : (
                          <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
                        )}
                        <span>{step.step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {msg.action && !msg.plan && (
              <div className="devagents-message-action">
                <CheckCircle2 size={12} className={agentInfo.color} />
                {msg.action.label}
              </div>
            )}

            <div className="devagents-message-bubble agent">
              {msg.content.split(t('teamMessage.mentionBackend')).map((part, i, arr) =>
                i === arr.length - 1 ? <span key={`part-${i}`}>{part}</span> : <span key={`part-${i}`}>{part}<span className="devagents-mention">{t('teamMessage.mentionBackend')}</span></span>
              )}
            </div>

            {msg.hasArtifact && (
              <div className="devagents-artifact-card">
                <div className="devagents-artifact-icon">
                  <Code2 size={16} />
                </div>
                <div className="devagents-artifact-info">
                  <div className="devagents-artifact-title">{msg.artifactTitle}</div>
                  <div className="devagents-artifact-status">{t('teamMessage.syncedToWorkspace')}</div>
                </div>
                <button className="devagents-artifact-review">Review</button>
              </div>
            )}
            {time && <span className="devagents-message-time">{time}</span>}
          </>
        )}
      </div>
    </div>
  );
});

export default TeamMessage;