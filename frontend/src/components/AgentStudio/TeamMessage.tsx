import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  Terminal,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
  Pencil,
  Play,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import type { Message, Agent } from '../../types/AgentStudio';
import { useTranslation } from 'react-i18next';
import { sanitizeHtml } from '../../utils/sanitize';
import { CopyBtn, CodeBlock } from './messages';

const TeamMessage = memo(function TeamMessage({
  msg,
  allAgents,
  onEditMessage,
  onRegenerate,
  showContinue,
  onContinue,
  onSwitchVersion,
  isContinuing,
  onThumbsFeedback,
}: {
  msg: Message;
  allAgents: Agent[];
  onEditMessage?: (msgId: string, newContent: string) => void;
  onRegenerate?: (msgId: string) => void;
  showContinue?: boolean;
  onContinue?: () => void;
  onSwitchVersion?: (msgId: string, direction: 'prev' | 'next') => void;
  isContinuing?: boolean;
  onThumbsFeedback?: (msgId: string, value: 'up' | 'down') => void;
}) {
  const { t, i18n } = useTranslation();
  const isUser = msg.role === 'user';
  const [isProcessExpanded, setIsProcessExpanded] = useState(true);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const thinkingBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = thinkingBodyRef.current;
    if (el && isThinkingExpanded) {
      el.scrollTop = el.scrollHeight;
    }
  }, [msg.thinking?.length, isThinkingExpanded]);

  const versions = msg.versions || [msg.content];
  const currentVersion = msg.currentVersion ?? 0;

  if (isUser) {
    const time = msg.timestamp
      ? new Date(msg.timestamp).toLocaleTimeString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const startEditing = () => {
      setEditText(msg.content);
      setIsEditing(true);
    };

    const cancelEdit = () => {
      setIsEditing(false);
      setEditText('');
    };

    const saveEdit = () => {
      if (editText.trim() && onEditMessage) {
        onEditMessage(msg.id, editText.trim());
      }
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveEdit();
      }
      if (e.key === 'Escape') {
        cancelEdit();
      }
    };

    if (isEditing) {
      return (
        <div className="flex justify-end w-full">
          <div className="flex items-center gap-2 w-full px-4 py-3 border border-[var(--color-border)] rounded-xl bg-[var(--color-surface-raised)]">
            <textarea
              className="flex-1 border-none bg-transparent text-[var(--color-text-primary)] text-base font-[inherit] leading-[1.5] resize-none outline-none min-h-6 max-h-[120px] placeholder:text-[var(--color-text-muted)]"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={1}
            />
            <div className="flex gap-2 flex-shrink-0">
              <button className="px-4 py-1.5 border border-[var(--color-border)] rounded-lg bg-transparent text-[var(--color-text-secondary)] text-sm cursor-pointer transition-colors duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
              <button className="px-4 py-1.5 border border-[var(--color-border)] rounded-lg bg-transparent text-[var(--color-text-secondary)] text-sm cursor-pointer transition-colors duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed" onClick={saveEdit}>
                {t('common.send')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="flex flex-col gap-1 items-end max-w-[80%]">
          <div className="flex flex-col items-end w-fit max-w-full">
            <div className="px-4 py-3 rounded-[12px_12px_4px_12px] bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]">{sanitizeHtml(msg.content)}</div>
            <div className="flex items-center gap-2 mt-1 w-full justify-end">
              <CopyBtn text={msg.content} label={t('teamMessage.copy')} />
              <button
                className="px-1.5 py-1 bg-transparent border-none rounded text-[var(--color-text-muted)] cursor-pointer flex items-center transition-colors duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                onClick={startEditing}
                title={t('teamMessage.edit')}
                aria-label={t('teamMessage.edit')}
              >
                <Pencil size={12} />
              </button>
              {time && <span className="block text-xs text-[var(--color-text-muted)] mt-1 ml-0">{time}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const agentInfo = allAgents.find((a) => a.id === msg.agentId) || {
    name: t('teamMessage.unknownAgent'),
    role: t('teamMessage.system'),
    icon: Bot,
    color: 'text-[var(--color-text-muted)]',
    bg: 'bg-[var(--color-surface-raised)]',
    border: 'border-[var(--color-border)]',
  };
  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col gap-1 items-start max-w-full bg-[var(--color-surface)]/30 px-4 py-3 rounded-xl">
        {msg.isTyping ? (
          <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface-raised)] rounded-[12px_12px_12px_4px] w-fit">
            <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
            <span>{t('agent.thinking', { name: agentInfo.name })}</span>
          </div>
        ) : (
          <>
            {msg.plan && (
              <div className="bg-[var(--color-surface-raised)] rounded-lg overflow-hidden mt-1">
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-hover)]"
                  onClick={() => setIsProcessExpanded(!isProcessExpanded)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isProcessExpanded}
                  aria-controls="process-steps"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsProcessExpanded(!isProcessExpanded);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
                    <Terminal size={12} className={agentInfo.color} />
                    {t('teamMessage.executeTask', { count: String(msg.plan.length) })}
                  </div>
                  {isProcessExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>

                {isProcessExpanded && (
                  <div className="p-3 flex flex-col gap-2" id="process-steps">
                    {msg.plan.map((step) => (
                      <div key={step.step} className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        {step.status === 'completed' ? (
                          <CheckCircle2 size={14} className="text-[var(--color-success)]" />
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
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <CheckCircle2 size={12} className={agentInfo.color} />
                {msg.action.label}
              </div>
            )}

            <div className="flex flex-row items-start gap-2 w-full">
              <div className="flex-1 min-w-0 bg-transparent text-[var(--color-text-primary)] rounded-none p-0 text-base leading-[1.7]">
              {msg.thinking && msg.thinking.length > 0 && (
                <div className="mb-3">
                  {msg.thinkingDone ? (
                    <>
                      <button
                        className="inline-flex items-center gap-1.5 p-0 bg-none border-none cursor-pointer text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-text-primary)]"
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        aria-expanded={isThinkingExpanded}
                      >
                        <Sparkles size={14} className={agentInfo.color} />
                        <span>{t('teamMessage.thinkingComplete')}</span>
                        <span className="text-xs text-[var(--color-text-muted)] ml-1">
                          {Math.max(1, Math.round((msg.thinking ?? '').length / 50))}{t('teamMessage.seconds')}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {isThinkingExpanded ? t('teamMessage.collapse') : t('teamMessage.expand')}
                        </span>
                        {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isThinkingExpanded && (() => {
                        const nodes = (msg.thinking ?? '').split(/\n{2,}/).filter(Boolean);
                        return (
                          <div className="relative mt-2 max-h-[420px] overflow-y-auto text-xs text-[var(--color-text-muted)] leading-[1.65]" ref={thinkingBodyRef}>
                            {nodes.map((node, i) => (
                              <div key={i} className="relative pl-5 mb-2.5 min-h-[18px] last:mb-0">
                                <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)] border-2 border-[var(--color-surface)] z-[1]" />
                                <div className="absolute left-[5px] top-0 bottom-0 w-[1.5px] bg-[var(--color-border)] z-0" />
                                <div className="whitespace-pre-wrap break-words leading-[1.65]">{node.trim()}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  ) : showContinue ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 p-0 bg-none border-none cursor-default text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-text-primary)]">
                        <Sparkles size={14} className={agentInfo.color} />
                        <span>{t('teamMessage.thinkingStopped')}</span>
                      </div>
                      {msg.thinking && (() => {
                        const nodes = msg.thinking.split(/\n{2,}/).filter(Boolean);
                        return (
                          <div className="relative mt-2 max-h-[420px] overflow-y-auto text-xs text-[var(--color-text-muted)] leading-[1.65]" ref={thinkingBodyRef}>
                            {nodes.map((node, i) => (
                              <div key={i} className="relative pl-5 mb-2.5 min-h-[18px] last:mb-0">
                                <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)] border-2 border-[var(--color-surface)] z-[1]" />
                                <div className="absolute left-[5px] top-0 bottom-0 w-[1.5px] bg-[var(--color-border)] z-0" />
                                <div className="whitespace-pre-wrap break-words leading-[1.65]">{node.trim()}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <button
                        className="inline-flex items-center gap-1.5 p-0 bg-none border-none cursor-pointer text-xs font-medium text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-text-primary)]"
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        aria-expanded={isThinkingExpanded}
                      >
                        <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
                        <span>{t('teamMessage.thinkingPending')}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {isThinkingExpanded ? t('teamMessage.collapse') : t('teamMessage.expand')}
                        </span>
                        {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isThinkingExpanded && (
                        <div className="relative mt-2 max-h-[420px] overflow-y-auto text-xs text-[var(--color-text-muted)] leading-[1.65]" ref={thinkingBodyRef}>
                          {msg.thinking ? (() => {
                            const nodes = msg.thinking.split(/\n{2,}/).filter(Boolean);
                            return nodes.map((node, i) => (
                              <div key={i} className="relative pl-5 mb-2.5 min-h-[18px] last:mb-0">
                                <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-[var(--color-text-muted)] border-2 border-[var(--color-surface)] z-[1]" />
                                <div className="absolute left-[5px] top-0 bottom-0 w-[1.5px] bg-[var(--color-border)] z-0" />
                                <div className="whitespace-pre-wrap break-words leading-[1.65]">{node.trim()}</div>
                              </div>
                            ));
                          })() : null}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <ReactMarkdown
                components={{
                  ul({ children, ...props }) {
                    return <ul className="my-2 pl-6 list-outside" {...props}>{children}</ul>;
                  },
                  ol({ children, ...props }) {
                    return <ol className="my-2 pl-6 list-outside list-decimal" {...props}>{children}</ol>;
                  },
                  li({ children, ...props }) {
                    return <li className="my-1 pl-1" {...props}>{children}</li>;
                  },
                  p({ children, ...props }) {
                    return <p className="m-0 mb-3 last:mb-0" {...props}>{children}</p>;
                  },
                  code({ className, children }) {
                    return <CodeBlock className={className} children={children} t={t} />;
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            </div>

            {showContinue && !isContinuing && (
              <div className="flex items-center gap-2 pt-1 pb-0 w-full">
                <span className="flex-1 h-px border-t border-dashed border-[var(--color-text-muted)] opacity-50" />
                <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap select-none">{t('teamMessage.interrupted')}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1 w-full">
              {versions.length > 1 && (
                <div className="flex items-center gap-0.5">
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-35 disabled:cursor-not-allowed"
                    onClick={() => onSwitchVersion?.(msg.id, 'prev')}
                    disabled={currentVersion === 0}
                    aria-label="Previous version"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                  </button>
                  <span className="text-xs text-[var(--color-text-muted)] min-w-7 text-center select-none">{currentVersion + 1}/{versions.length}</span>
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-35 disabled:cursor-not-allowed"
                    onClick={() => onSwitchVersion?.(msg.id, 'next')}
                    disabled={currentVersion === versions.length - 1}
                    aria-label="Next version"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
              <CopyBtn text={msg.content} label={t('teamMessage.copy')} />
              <button
                className="px-1 py-0.5 bg-transparent border-none rounded text-[var(--color-text-muted)] cursor-pointer flex items-center transition-colors duration-150 hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                onClick={() => onRegenerate?.(msg.id)}
                title={t('teamMessage.regenerate')}
                aria-label={t('teamMessage.regenerate')}
              >
                <RotateCcw size={12} />
              </button>
              {!isUser && (
                <>
                  <button
                    className={`flex items-center justify-center min-w-[24px] min-h-[24px] bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]${msg.thumbsFeedback === 'up' ? ' bg-[var(--color-accent)] !text-[var(--color-text-on-accent)] !border-[var(--color-accent)]' : ''}`}
                    onClick={() => onThumbsFeedback?.(msg.id, msg.thumbsFeedback === 'up' ? 'down' : 'up')}
                    title={msg.thumbsFeedback === 'up' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsUp')}
                    aria-label={msg.thumbsFeedback === 'up' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsUp')}
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button
                    className={`flex items-center justify-center min-w-[24px] min-h-[24px] bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]${msg.thumbsFeedback === 'down' ? ' bg-[var(--color-accent)] !text-[var(--color-text-on-accent)] !border-[var(--color-accent)]' : ''}`}
                    onClick={() => onThumbsFeedback?.(msg.id, msg.thumbsFeedback === 'down' ? 'up' : 'down')}
                    title={msg.thumbsFeedback === 'down' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsDown')}
                    aria-label={msg.thumbsFeedback === 'down' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsDown')}
                  >
                    <ThumbsDown size={12} />
                  </button>
                </>
              )}
              {time && <span className="block text-xs text-[var(--color-text-muted)] mt-1 ml-0">{time}</span>}
              {(showContinue || isContinuing) && (
                <button
                  className={`flex items-center gap-[3px] px-2 py-0.5 bg-transparent border border-[var(--color-accent)] rounded-md text-[var(--color-accent)] cursor-pointer text-xs font-medium ml-auto transition-colors duration-150 hover:bg-[var(--color-accent)] hover:text-[var(--color-text-on-accent)]${isContinuing ? ' opacity-70 cursor-wait' : ''}`}
                  onClick={isContinuing ? undefined : onContinue}
                  disabled={isContinuing}
                  title={isContinuing ? t('teamMessage.continuing') : t('teamMessage.continue')}
                  aria-label={isContinuing ? t('teamMessage.continuing') : t('teamMessage.continue')}
                >
                  {isContinuing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  <span>{isContinuing ? t('teamMessage.continuing') : t('teamMessage.continue')}</span>
                </button>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
});

export default TeamMessage;
