import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));
vi.mock('../../utils/sanitize', () => ({
  sanitizeHtml: (d: string) => d,
}));
vi.mock('../../messages/CodeBlock', () => ({ CodeBlock: () => null }));
vi.mock('../../messages/CopyBtn', () => ({ CopyBtn: () => null }));
vi.mock('../../messages/LazyCodeBlock', () => ({ default: () => null }));

import TeamMessage from '../TeamMessage';
import type { Message, Agent } from '../../../types/AgentStudio';

const mockAgent: Agent = { id: 'a1', name: 'TestAgent', icon: 'Bot', color: '#6366f1' } as Agent;

function makeMsg(overrides: Partial<Message> = {}): Message {
  return { id: 'm1', role: 'agent', content: 'Hello', agentId: 'a1', ...overrides } as Message;
}

describe('rehypeLinkify recursion guard', { tags: ['unit'] }, () => {
  it('renders URL followed by CJK period without stack overflow', () => {
    expect(() => {
      render(
        <TeamMessage
          msg={makeMsg({ thinking: '打开 https://www.douyin.com/。 首页', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
    }).not.toThrow();
  });

  it('renders the exact crashing thinking content (URL + CJK period + tool call)', () => {
    const thinking =
      '用户让我打开抖音，我需要使用 open_user_browser 工具来在用户浏览器中打开抖音的网址。' +
      '抖音的网址是 https://www.douyin.com/。\n\n' +
      '[tools] open_user_browser({"url": "https://www.douyin.com/"})[result] ' +
      "open_user_browser → Opened https://www.douyin.com/ in the user's browser.\n\n" +
      '抖音已经成功在用户浏览器中打开了。';
    expect(() => {
      render(
        <TeamMessage
          msg={makeMsg({ thinking, thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
    }).not.toThrow();
  });

  it('renders a URL inside a sentence', () => {
    const { container } = render(
      <TeamMessage
        msg={makeMsg({ thinking: '参考 https://news.baidu.com 网页内容', thinkingDone: true })}
        allAgents={[mockAgent]}
      />
    );
    expect(container.querySelector('a[href="https://news.baidu.com"]')).toBeTruthy();
  });
});
