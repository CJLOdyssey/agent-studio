import { useEffect, useRef } from 'react';
import type { ChatMessage, RunResult } from '../../types';
import MessageBubble from './MessageBubble';
import ResultDisplay from './ResultDisplay';

interface Props {
  messages: ChatMessage[];
  result: RunResult | null;
  loading: boolean;
  status?: string;
  error?: string | null;
  currentRole?: string | null;
}

export default function ChatMessages({ messages, result, loading, status, error, currentRole }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, result]);

  const agentMsgCount = messages.filter((m) => m.role !== 'user').length;

  if (messages.length === 0 && !loading && !error && status !== 'completed') {
    return (
      <div className="chat-messages" aria-live="polite">
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <div className="empty-state-title">虚拟软件外包团队</div>
          <div className="empty-state-desc">
            输入需求，三名 AI 角色（产品经理、资深程序员、测试工程师）将自动展开讨论，
            评估需求可行性、技术和测试方案。
          </div>
          <div className="empty-state-steps">
            <div className="empty-state-step">
              <div className="empty-state-step-icon">📋</div>
              <div>分析需求</div>
            </div>
            <div className="empty-state-step">
              <div className="empty-state-step-icon">💬</div>
              <div>分组讨论</div>
            </div>
            <div className="empty-state-step">
              <div className="empty-state-step-icon">📄</div>
              <div>产出结果</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      <div className="chat-messages-inner" aria-live="polite">
        {error && agentMsgCount === 0 && (
          <div className="chat-error-state">
            <div className="chat-error-icon">⚠️</div>
            <div className="chat-error-title">讨论未完成</div>
            <div className="chat-error-message">{error}</div>
            <div className="chat-error-hint">
              请配置有效的 DeepSeek API Key 或在 .env 中设置真实密钥
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} message={msg} />
        ))}

        {status === 'loading' && (
          <div className="process-indicator">
            <span className="process-dot" />
            <span className="process-text">正在呼叫 AI 团队...</span>
          </div>
        )}

        {status === 'running' && agentMsgCount === 0 && (
          <div className="process-indicator">
            <span className="process-dot" />
            <span className="process-text">AI 团队正在分析需求...</span>
          </div>
        )}

        {status === 'running' && agentMsgCount > 0 && loading && (
          <div className="process-indicator">
            <span className="process-dot" />
            <span className="process-text">
              {currentRole ? `${currentRole} 正在思考...` : '讨论进行中...'}
            </span>
          </div>
        )}

        {messages.length === 0 && loading && (
          <div className="chat-loading-state">
            <div className="chat-loading-icon">🤖</div>
            <div className="chat-loading-title">团队正在讨论中...</div>
            <div className="chat-loading-desc">
              三位 AI Agent 正在分析你的需求
            </div>
          </div>
        )}

        {result && <ResultDisplay result={result} />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
