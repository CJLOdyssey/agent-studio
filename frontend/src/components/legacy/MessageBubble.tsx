import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { ChatMessage } from '../../types';
import { getAgentInfo } from '../../types';
import { useChatStore } from '../../stores/chatStore';
import { sanitizeHtml } from '../../utils/sanitize';

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const agents = useChatStore((s) => s.agents);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="message message-user">
        <div className="message-content message-content-user">
          {message.content}
        </div>
      </div>
    );
  }

  const info = getAgentInfo(agents, message.role);

  return (
    <div className="message">
      <div className="message-header">
        <span className="message-role-icon">{info.icon}</span>
        <span className="message-role-name" style={{ color: info.color }}>
          {info.label}
        </span>
        {message.round_number != null && message.round_number > 0 && (
          <span className="message-round">Round {message.round_number}</span>
        )}
      </div>
      <div className="message-content">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const codeStr = String(children).replace(/\n$/, '');
              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: 8, fontSize: 13 }}
                  >
                    {codeStr}
                  </SyntaxHighlighter>
                );
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {sanitizeHtml(message.content)}
        </ReactMarkdown>
      </div>
    </div>
  );
}
