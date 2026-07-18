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
import type { Message, Agent } from '../../types/agentstudio';
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
        <div className="agentstudio-edit-bar-wrapper">
          <div className="agentstudio-edit-bar">
            <textarea
              className="agentstudio-edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={1}
            />
            <div className="agentstudio-edit-actions">
              <button className="agentstudio-edit-cancel" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
              <button className="agentstudio-edit-send" onClick={saveEdit}>
                {t('common.send')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="agentstudio-message agentstudio-message-user">
        <div className="agentstudio-message-content-wrapper user">
          <div className="agentstudio-message-bubble-group">
            <div className="agentstudio-message-bubble user">{sanitizeHtml(msg.content)}</div>
            <div className="agentstudio-message-actions">
              <CopyBtn text={msg.content} label={t('teamMessage.copy')} />
              <button
                className="agentstudio-msg-edit"
                onClick={startEditing}
                title={t('teamMessage.edit')}
                aria-label={t('teamMessage.edit')}
              >
                <Pencil size={12} />
              </button>
              {time && <span className="agentstudio-message-time" style={{ marginLeft: 0 }}>{time}</span>}
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
    color: 'text-[var(--da-text-muted)]',
    bg: 'bg-[var(--da-bg-surface)]',
    border: 'border-[var(--da-border)]',
  };
  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="agentstudio-message agentstudio-message-agent">
      <div className="agentstudio-message-content-wrapper agent">
        {msg.isTyping ? (
          <div className="agentstudio-message-typing">
            <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
            <span>{t('agent.thinking', { name: agentInfo.name })}</span>
          </div>
        ) : (
          <>
            {msg.plan && (
              <div className="agentstudio-process-panel">
                <div
                  className="agentstudio-process-header"
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
                  <div className="agentstudio-process-title">
                    <Terminal size={12} className={agentInfo.color} />
                    {t('teamMessage.executeTask', { count: String(msg.plan.length) })}
                  </div>
                  {isProcessExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>

                {isProcessExpanded && (
                  <div className="agentstudio-process-steps" id="process-steps">
                    {msg.plan.map((step) => (
                      <div key={step.step} className="agentstudio-process-step">
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
              <div className="agentstudio-message-action">
                <CheckCircle2 size={12} className={agentInfo.color} />
                {msg.action.label}
              </div>
            )}

            <div className="agentstudio-message-bubble-row">
              <div className="agentstudio-message-bubble agent ds-markdown">
              {msg.thinking && msg.thinking.length > 0 && (
                <div className="ds-thinking-block">
                  {msg.thinkingDone ? (
                    <>
                      <button
                        className="ds-thinking-header"
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        aria-expanded={isThinkingExpanded}
                      >
                        <Sparkles size={14} className={agentInfo.color} />
                        <span>{t('teamMessage.thinkingComplete')}</span>
                        <span className="ds-thinking-time">
                          {Math.max(1, Math.round((msg.thinking ?? '').length / 50))}{t('teamMessage.seconds')}
                        </span>
                        <span className="ds-thinking-meta">
                          {isThinkingExpanded ? t('teamMessage.collapse') : t('teamMessage.expand')}
                        </span>
                        {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isThinkingExpanded && (() => {
                        const nodes = (msg.thinking ?? '').split(/\n{2,}/).filter(Boolean);
                        return (
                          <div className="ds-thinking-body" ref={thinkingBodyRef}>
                            {nodes.map((node, i) => (
                              <div key={i} className="ds-think-node">
                                <div className="ds-think-dot" />
                                <div className="ds-think-branch" />
                                <div className="ds-think-text">{node.trim()}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  ) : showContinue ? (
                    <>
                      <div className="ds-thinking-header" style={{ cursor: 'default' }}>
                        <Sparkles size={14} className={agentInfo.color} />
                        <span>{t('teamMessage.thinkingStopped')}</span>
                      </div>
                      {msg.thinking && (() => {
                        const nodes = msg.thinking.split(/\n{2,}/).filter(Boolean);
                        return (
                          <div className="ds-thinking-body" ref={thinkingBodyRef}>
                            {nodes.map((node, i) => (
                              <div key={i} className="ds-think-node">
                                <div className="ds-think-dot" />
                                <div className="ds-think-branch" />
                                <div className="ds-think-text">{node.trim()}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <button
                        className="ds-thinking-header"
                        onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        aria-expanded={isThinkingExpanded}
                      >
                        <Loader2 size={14} className={`${agentInfo.color} animate-spin`} />
                        <span>{t('teamMessage.thinkingPending')}</span>
                        <span className="ds-thinking-meta">
                          {isThinkingExpanded ? t('teamMessage.collapse') : t('teamMessage.expand')}
                        </span>
                        {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isThinkingExpanded && (
                        <div className="ds-thinking-body" ref={thinkingBodyRef}>
                          {msg.thinking ? (() => {
                            const nodes = msg.thinking.split(/\n{2,}/).filter(Boolean);
                            return nodes.map((node, i) => (
                              <div key={i} className="ds-think-node">
                                <div className="ds-think-dot" />
                                <div className="ds-think-branch" />
                                <div className="ds-think-text">{node.trim()}</div>
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
                    return <ul className="ds-markdown-list" {...props}>{children}</ul>;
                  },
                  ol({ children, ...props }) {
                    return <ol className="ds-markdown-list ds-markdown-ordered" {...props}>{children}</ol>;
                  },
                  li({ children, ...props }) {
                    return <li className="ds-markdown-list-item" {...props}>{children}</li>;
                  },
                  p({ children, ...props }) {
                    return <p className="ds-markdown-paragraph" {...props}>{children}</p>;
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
              <div className="agentstudio-msg-interrupted">
                <span className="agentstudio-msg-interrupted-line" />
                <span className="agentstudio-msg-interrupted-label">{t('teamMessage.interrupted')}</span>
              </div>
            )}

            <div className="agentstudio-message-actions">
              {versions.length > 1 && (
                <div className="agentstudio-version-pagination">
                  <button
                    className="agentstudio-version-btn"
                    onClick={() => onSwitchVersion?.(msg.id, 'prev')}
                    disabled={currentVersion === 0}
                    aria-label="Previous version"
                  >
                    <ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <span className="agentstudio-version-count">{currentVersion + 1}/{versions.length}</span>
                  <button
                    className="agentstudio-version-btn"
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
                className="agentstudio-msg-regenerate"
                onClick={() => onRegenerate?.(msg.id)}
                title={t('teamMessage.regenerate')}
                aria-label={t('teamMessage.regenerate')}
              >
                <RotateCcw size={12} />
              </button>
              {!isUser && (
                <>
                  <button
                    className={`agentstudio-msg-thumb${msg.thumbsFeedback === 'up' ? ' active' : ''}`}
                    onClick={() => onThumbsFeedback?.(msg.id, msg.thumbsFeedback === 'up' ? 'down' : 'up')}
                    title={msg.thumbsFeedback === 'up' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsUp')}
                    aria-label={msg.thumbsFeedback === 'up' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsUp')}
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button
                    className={`agentstudio-msg-thumb${msg.thumbsFeedback === 'down' ? ' active' : ''}`}
                    onClick={() => onThumbsFeedback?.(msg.id, msg.thumbsFeedback === 'down' ? 'up' : 'down')}
                    title={msg.thumbsFeedback === 'down' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsDown')}
                    aria-label={msg.thumbsFeedback === 'down' ? t('teamMessage.removeFeedback') : t('teamMessage.thumbsDown')}
                  >
                    <ThumbsDown size={12} />
                  </button>
                </>
              )}
              {time && <span className="agentstudio-message-time" style={{ marginLeft: 0 }}>{time}</span>}
              {(showContinue || isContinuing) && (
                <button
                  className={`agentstudio-msg-continue${isContinuing ? ' loading' : ''}`}
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
