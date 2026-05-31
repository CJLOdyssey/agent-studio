import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ChatMessage, AgentConfig } from '../../types';

const mockAgents: AgentConfig[] = [
  { id: '1', name: '产品经理', role_identifier: 'pm', system_prompt: '需求分析', model: null, temperature: null, order: 1, is_active: true, is_approver: false, icon: '📋', created_at: null },
];

vi.mock('../../stores/chatStore', () => ({
  useChatStore: (selector: (s: { agents: AgentConfig[] }) => unknown) => {
    const state = { agents: mockAgents };
    return selector ? selector(state) : state;
  },
}));

import MessageBubble from '../legacy/MessageBubble';

describe('MessageBubble', () => {
  const baseMessage: ChatMessage = {
    id: 'msg-1',
    role: 'pm',
    agent_name: '产品经理',
    content: '这是一个测试消息',
    round_number: 1,
    created_at: '2024-01-01T00:00:00Z',
  };

  it('渲染代理图标和名称', () => {
    render(<MessageBubble message={baseMessage} />);
    expect(screen.getByText('产品经理')).toBeInTheDocument();
    expect(screen.getByText('📋')).toBeInTheDocument();
  });

  it('渲染消息内容', () => {
    render(<MessageBubble message={baseMessage} />);
    expect(screen.getByText('这是一个测试消息')).toBeInTheDocument();
  });

  it('显示 round 编号', () => {
    render(<MessageBubble message={baseMessage} />);
    expect(screen.getByText('Round 1')).toBeInTheDocument();
  });

  it('round_number 为 0 时不显示 Round', () => {
    const msg = { ...baseMessage, round_number: 0 };
    render(<MessageBubble message={msg} />);
    expect(screen.queryByText(/Round/)).not.toBeInTheDocument();
  });

  it('渲染用户消息（右对齐气泡）', () => {
    const userMsg: ChatMessage = {
      id: 'user-1',
      role: 'user',
      agent_name: '我',
      content: '写一个贪吃蛇游戏',
      round_number: 0,
      created_at: '2024-01-01T00:00:00Z',
    };
    const { container } = render(<MessageBubble message={userMsg} />);
    expect(container.querySelector('.message-user')).toBeInTheDocument();
    expect(container.querySelector('.message-content-user')).toBeInTheDocument();
    expect(screen.getByText('写一个贪吃蛇游戏')).toBeInTheDocument();
  });

  it('渲染 Markdown 加粗文本', () => {
    const msg = { ...baseMessage, content: '**重要内容**' };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('重要内容')).toBeInTheDocument();
  });

  it('渲染代码块', () => {
    const msg = { ...baseMessage, content: '```\nconst x = 1;\n```' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('pre')).toBeInTheDocument();
  });

  it('空内容不崩溃', () => {
    const msg = { ...baseMessage, content: '' };
    const { container } = render(<MessageBubble message={msg} />);
    expect(container.querySelector('.message')).toBeInTheDocument();
  });

  it('未知角色使用 role 作为标签', () => {
    const msg = { ...baseMessage, role: 'unknown_role', agent_name: '自定义名' };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText('unknown_role')).toBeInTheDocument();
  });
});
