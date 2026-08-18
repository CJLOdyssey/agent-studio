import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { visit } from 'unist-util-visit';
import type { Root, ElementContent } from 'hast';
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
  XCircle,
} from 'lucide-react';
import type { Message, Agent } from '../../types/AgentStudio';
import { useTranslation } from 'react-i18next';
import { sanitizeHtml } from '../../utils/sanitize';
import { CopyBtn, CodeBlock } from './messages';
import MessageAttachments from './MessageAttachments';
import type { TeamVerdict } from '../../stores/wsEvents';
import type * as React from 'react';

function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https?:\/\/[^\s"',)\]}]+)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-[var(--color-accent)] hover:opacity-80 break-all">{part}</a>
      : part,
  );
}

function markdownComponents(t: (key: string) => string): Components {
  return {
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
    img({ src, alt }) {
      return <img src={src} alt={alt} className="max-w-full h-auto rounded-lg border border-[var(--color-border)]" />;
    },
  };
}

function ThinkingMarkdown({ t, children }: { t: (key: string) => string; children: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeLinkify]}
      components={{
        ...markdownComponents(t),
        p({ children }) {
          return <p className="m-0">{children}</p>;
        },
        a({ href, children }) {
          return <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-[var(--color-accent)] hover:opacity-80 break-all">{children}</a>;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

const BARE_URL_RE = /(https?:\/\/[^\s"',)\]}]+|\/api\/attachments\/[^\s"',)\]}]+)/g;

function rehypeLinkify() {
  return (tree: Root) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof node.value !== 'string' || typeof index !== 'number') return;
      if (parent.type === 'element' && parent.tagName === 'a') return;
      const parts = node.value.split(BARE_URL_RE);
      if (parts.length === 1) return;
      const children: ElementContent[] = [];
      for (const part of parts) {
        if (!part) continue;
        if (/^(https?:\/\/|\/api\/attachments\/)/.test(part)) {
          children.push({
            type: 'element',
            tagName: 'a',
            properties: { href: part, target: '_blank', rel: ['noopener', 'noreferrer'] },
            children: [{ type: 'text', value: part }],
          });
        } else {
          children.push({ type: 'text', value: part });
        }
      }
      parent.children.splice(index, 1, ...children);
      return index + children.length - 1;
    });
  };
}

type ParsedNode = { prefix: string; rest: string } | null;

function parseNode(text: string): ParsedNode {
  const t = text.trim();
  const match = t.match(/^\[(tools|mcp|skill|result|info)\]\s+(.*)/);
  if (match) return { prefix: match[1], rest: match[2] };

  if (t.startsWith('🔧')) return { prefix: 'tools', rest: t.replace(/^🔧\s*/, '') };
  if (t.startsWith('📡')) return { prefix: 'mcp', rest: t.replace(/^📡\s*/, '') };
  if (t.startsWith('🛠️')) return { prefix: 'skill', rest: t.replace(/^🛠️\s*/, '') };
  if (t.startsWith('📥')) return { prefix: 'result', rest: t.replace(/^📥\s*/, '') };
  if (t.startsWith('📋') || t.startsWith('📏')) return { prefix: 'info', rest: t.replace(/^[^\s]+\s*/, '') };

  return null;
}

type ThinkingItem =
  | { type: 'node'; node: string; parsed: ParsedNode }
  | { type: 'toolPair'; callNode: string; resultNode: string; callParsed: NonNullable<ParsedNode>; resultParsed: NonNullable<ParsedNode> };

function groupThinkingNodes(text: string): ThinkingItem[] {
  // L2: 工具调用前缀（[tools]/[mcp]/[skill]/emoji）行首锚定 + 补 📏——
  // 避免句中出现的 "[tools]" 之类文本把段落错拆成工具卡。
  // [result]/[info] 保持任意位置可拆：单行 "[skill] xxx[result] yyy" 需靠
  // 行中 [result] 拆分才能组成 toolPair。
  const nodes = text.split(/\n{2,}|(?=^\[(?:tools|mcp|skill)\]|^🔧|^📡|^🛠️|\[(?:result|info)\]|📋|📏|📥)/m).filter(Boolean);
  const items: ThinkingItem[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const cur = parseNode(nodes[i]);
    const isToolCall = cur && (cur.prefix === 'tools' || cur.prefix === 'mcp' || cur.prefix === 'skill');
    if (isToolCall && i + 1 < nodes.length) {
      const nxt = parseNode(nodes[i + 1]);
      if (nxt && nxt.prefix === 'result') {
        items.push({
          type: 'toolPair',
          callNode: nodes[i],
          resultNode: nodes[i + 1],
          callParsed: cur,
          resultParsed: nxt,
        });
        i++;
        continue;
      }
    }
    // [tools] without [result] → create toolPair with empty result
    // L3: 空 result 不再复用调用文本（展开后重复显示调用内容本身）。
    if (isToolCall) {
      items.push({
        type: 'toolPair',
        callNode: nodes[i],
        resultNode: `[result] ${cur.rest}`,
        callParsed: cur,
        resultParsed: { prefix: 'result', rest: '' },
      });
      continue;
    }
    items.push({ type: 'node', node: nodes[i], parsed: cur });
  }
  return items;
}

function ToolCallCard({
  callParsed,
  resultParsed,
  t,
}: {
  callParsed: NonNullable<ParsedNode>;
  resultParsed: NonNullable<ParsedNode>;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const resultDisplay = resultParsed.rest.replace(/^\w+\s*(?:→|返回:)\s*/, '');
  // L3: 无 result 时展开区显示占位，而不是重复调用文本。
  const display = resultDisplay || '(无返回结果)';

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="cursor-pointer select-none rounded-sm hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="text-base leading-[1.65] text-[var(--color-text-secondary)]">
          <span>[{callParsed.prefix}]</span>
          {' '}
          <code className="text-[0.85em] font-[var(--font-mono)] break-all">{linkify(callParsed.rest)}</code>
        </div>
      </div>

      {expanded && (
        <div className="mt-1 flex gap-1.5 text-base leading-[1.65] text-[var(--color-text-muted)]">
          <span className="flex-none select-none text-[var(--color-text-tertiary)]">⟶</span>
          <div className="flex-1 min-w-0">
            <ThinkingMarkdown t={t}>{display}</ThinkingMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function ThinkingNodeDot() {
  return (
    <div className="absolute -left-3 top-[6px] w-2 h-2 rounded-full bg-[var(--color-text-muted)] border-2 border-[var(--color-surface)] z-[1]" />
  );
}

function ThinkingNodeItem({ item, t }: { item: ThinkingItem; t: (key: string) => string }) {
  if (item.type === 'toolPair') {
    return (
      <div className="relative mb-2.5 last:mb-0 pl-3">
        <ThinkingNodeDot />
        <ToolCallCard callParsed={item.callParsed} resultParsed={item.resultParsed} t={t} />
      </div>
    );
  }

  const parsed = item.parsed;
  const isInfo = parsed?.prefix === 'info';
  const displayText = parsed === null ? item.node.trim() : parsed.rest;
  return (
    <div className="relative mb-2.5 last:mb-0 leading-[1.65] pl-3">
      <ThinkingNodeDot />
      <div className="text-[var(--color-text-muted)]">
        {isInfo && <span className="text-[var(--color-text-tertiary)]">[info] </span>}
        <ThinkingMarkdown t={t}>{displayText}</ThinkingMarkdown>
      </div>
    </div>
  );
}

const TeamMessage = memo(function TeamMessage({
  msg,
  allAgents,
  onEditMessage,
  onRegenerate,
  showContinue,
  onContinue,
  onSwitchUserVersion,
  onSwitchAnswer,
  isContinuing,
  onThumbsFeedback,
}: {
  msg: Message;
  allAgents: Agent[];
  onEditMessage?: (msgId: string, newContent: string) => void;
  onRegenerate?: (msgId: string) => void;
  showContinue?: boolean;
  onContinue?: () => void;
  onSwitchUserVersion?: (msgId: string, direction: 'prev' | 'next') => void;
  onSwitchAnswer?: (msgId: string, direction: 'prev' | 'next') => void;
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

  const meta = msg as Message & {
    verdicts?: Record<string, TeamVerdict>;
    round?: number;
  };

  // 思考内容流式更新时跟随到底；用户手动滚动离开底部则暂停跟随。
  const thinkingAtBottomRef = useRef(true);
  useEffect(() => {
    const el = thinkingBodyRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      if (atBottom !== thinkingAtBottomRef.current) thinkingAtBottomRef.current = atBottom;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = thinkingBodyRef.current;
    if (el && isThinkingExpanded && thinkingAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [msg.thinking?.length, isThinkingExpanded]);

  if (isUser) {
    const userVersions = msg.userVersions || [msg.content];
    const currentUserVersion = msg.currentUserVersion ?? 0;
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
            {msg.attachments && msg.attachments.length > 0 && <MessageAttachments attachments={msg.attachments} />}
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
              {userVersions.length > 1 && (
                <div className="flex items-center gap-0.5">
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-35 disabled:cursor-not-allowed"
                    onClick={() => onSwitchUserVersion?.(msg.id, 'prev')}
                    disabled={currentUserVersion === 0}
                    aria-label="Previous user version"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                  </button>
                  <span className="text-xs text-[var(--color-text-muted)] min-w-7 text-center select-none">{currentUserVersion + 1}/{userVersions.length}</span>
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-35 disabled:cursor-not-allowed"
                    onClick={() => onSwitchUserVersion?.(msg.id, 'next')}
                    disabled={currentUserVersion === userVersions.length - 1}
                    aria-label="Next user version"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
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
          <div style={{ animation: 'fadeInUp 0.15s ease-out' }}>
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

            {meta.verdicts && Object.keys(meta.verdicts).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {Object.entries(meta.verdicts).map(([role, v]) => (
                  <span
                    key={role}
                    title={v.reason}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]"
                  >
                    {v.approved
                      ? <CheckCircle2 size={12} className="text-[var(--color-success)]" />
                      : <XCircle size={12} className="text-[#ef4444]" />}
                    <span>{role}</span>
                    <span className="text-[var(--color-text-muted)]">{t('teamMessage.rounds', { count: String(v.rounds) })}</span>
                    {v.reason && (
                      <span className="text-[var(--color-text-muted)] italic truncate max-w-[180px]">{v.reason}</span>
                    )}
                  </span>
                ))}
                {meta.round !== undefined && (
                  <span className="text-xs text-[var(--color-text-muted)]">{t('teamMessage.totalRounds', { count: String(meta.round) })}</span>
                )}
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
                        const items = groupThinkingNodes(msg.thinking ?? '');
                        return (
                          <div className="mt-2 grid animate-slide-down">
                            <div className="relative max-h-[420px] overflow-y-auto overflow-hidden text-base text-[var(--color-text-muted)] leading-[1.65]" ref={thinkingBodyRef}>
                              <div className="relative pl-4">
                                <div className="absolute left-2 top-0 bottom-0 w-px bg-[var(--color-border)] pointer-events-none" />
                                {items.map((item, i) => (
                                  <ThinkingNodeItem key={i} item={item} t={t} />
                                ))}
                              </div>
                            </div>
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
                        const items = groupThinkingNodes(msg.thinking);
                        return (
                          <div className="mt-2 grid animate-slide-down">
                            <div className="relative max-h-[420px] overflow-y-auto overflow-hidden text-base text-[var(--color-text-muted)] leading-[1.65]" ref={thinkingBodyRef}>
                              <div className="relative pl-4">
                                <div className="absolute left-2 top-0 bottom-0 w-px bg-[var(--color-border)] pointer-events-none" />
                                {items.map((item, i) => (
                                  <ThinkingNodeItem key={i} item={item} t={t} />
                                ))}
                              </div>
                            </div>
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
                        <div className="mt-2 grid animate-slide-down">
                          <div className="relative max-h-[420px] overflow-y-auto overflow-hidden text-base text-[var(--color-text-muted)] leading-[1.65]" ref={thinkingBodyRef}>
                            {msg.thinking ? (() => {
                              const items = groupThinkingNodes(msg.thinking);
                              return items.map((item, i) => (
                                <ThinkingNodeItem key={i} item={item} t={t} />
                              ));
                            })() : null}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <ReactMarkdown
                rehypePlugins={[rehypeLinkify]}
                components={{
                  ...markdownComponents(t),
                  a({ href, children }) {
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="underline text-[var(--color-accent)] hover:opacity-80 break-all">{children}</a>;
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
              {msg.answerVersions && msg.answerVersions.length > 1 && (
                <div className="flex items-center gap-0.5">
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-35 disabled:cursor-not-allowed"
                    onClick={() => onSwitchAnswer?.(msg.id, 'prev')}
                    disabled={(msg.currentAnswerVersion ?? 0) === 0}
                    aria-label="Previous answer version"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                  </button>
                  <span className="text-xs text-[var(--color-text-muted)] min-w-7 text-center select-none">{(msg.currentAnswerVersion ?? 0) + 1}/{msg.answerVersions.length}</span>
                  <button
                    className="flex items-center justify-center w-6 h-6 bg-transparent border border-[var(--color-border)] rounded text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150 p-0 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] disabled:opacity-35 disabled:cursor-not-allowed"
                    onClick={() => onSwitchAnswer?.(msg.id, 'next')}
                    disabled={(msg.currentAnswerVersion ?? 0) === msg.answerVersions.length - 1}
                    aria-label="Next answer version"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}
              {time && <span className="block text-xs text-[var(--color-text-muted)] mt-1 ml-0">{time}</span>}
              {(showContinue || isContinuing) && (
                <button
                  className={`flex items-center gap-1 px-2 py-0.5 bg-transparent border border-[var(--color-accent)] rounded-md text-[var(--color-accent)] cursor-pointer text-xs font-medium ml-auto transition-colors duration-150 hover:bg-[var(--color-accent)] hover:text-[var(--color-text-on-accent)]${isContinuing ? ' opacity-70 cursor-wait' : ''}`}
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

          </div>
        )}
      </div>
    </div>
  );
});

export default TeamMessage;
