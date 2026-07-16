import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyBtn } from './CopyBtn';
import type { ReactNode } from 'react';

export function CodeBlock({
  className,
  children,
  t,
}: {
  className?: string;
  children: ReactNode;
  t: (key: string) => string;
}) {
  const match = /language-(\w+)/.exec(className || '');
  const codeString = String(children).replace(/\n$/, '');
  if (match) {
    return (
      <div className="ds-code-block">
        <div className="ds-code-header">
          <span className="ds-code-lang">{match[1]}</span>
          <CopyBtn text={codeString} label={t('teamMessage.copy')} className="ds-code-copy" />
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: '0 0 6px 6px' }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className="ds-inline-code">{children}</code>
  );
}
