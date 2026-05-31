import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ChatMessage, RunResult } from '../../types';
import ChatMessages from '../legacy/ChatMessages';

vi.mock('../legacy/MessageBubble', () => ({
  default: ({ message }: { message: ChatMessage }) => (
    <div data-testid="message-bubble">{message.agent_name}: {message.content}</div>
  ),
}));

vi.mock('../ResultDisplay', () => {
  return {
    __esModule: true,
    default: function MockResultDisplay() {
      return React.createElement('div', { className: 'result-panel', 'data-testid': 'result-display' }, 'Result');
    },
  };
});

describe('ChatMessages', () => {
  const mockMessages: ChatMessage[] = [
    { id: '1', role: 'pm', agent_name: 'PM', content: '需求分析', round_number: 1, created_at: null },
    { id: '2', role: 'dev', agent_name: 'DEV', content: '技术方案', round_number: 1, created_at: null },
  ];

  const mockResult: RunResult = {
    requirement: 'test', pm_document: 'doc', code: 'code', review: 'review',
    approved: true, status: 'converged',
  };

  it('空状态显示欢迎界面', () => {
    render(<ChatMessages messages={[]} result={null} loading={false} status="idle" />);
    expect(screen.getByText('虚拟软件外包团队')).toBeInTheDocument();
    expect(screen.getByText('分析需求')).toBeInTheDocument();
    expect(screen.getByText('分组讨论')).toBeInTheDocument();
    expect(screen.getByText('产出结果')).toBeInTheDocument();
  });

  it('loading 状态显示连接指示器', () => {
    const { container } = render(<ChatMessages messages={[]} result={null} loading={true} status="loading" />);
    expect(container.querySelector('.process-indicator')).toBeInTheDocument();
    expect(screen.queryByText('虚拟软件外包团队')).not.toBeInTheDocument();
  });

  it('错误状态显示错误信息', () => {
    render(<ChatMessages messages={[]} result={null} loading={false} error="API Key 无效" />);
    expect(screen.getByText(/讨论未完成/)).toBeInTheDocument();
    expect(screen.getByText('API Key 无效')).toBeInTheDocument();
    expect(screen.getByText(/DeepSeek API Key/)).toBeInTheDocument();
  });

  it('渲染消息气泡列表', () => {
    render(<ChatMessages messages={mockMessages} result={null} loading={false} />);
    const bubbles = screen.getAllByTestId('message-bubble');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0]).toHaveTextContent('PM: 需求分析');
    expect(bubbles[1]).toHaveTextContent('DEV: 技术方案');
  });

  it('running 时显示进行中指示器', () => {
    const { container } = render(<ChatMessages messages={mockMessages} result={null} loading={true} status="running" currentRole="产品经理" />);
    expect(container.querySelector('.process-indicator')).toBeInTheDocument();
  });

  it('result 存在时渲染结果面板', () => {
    render(<ChatMessages messages={[]} result={mockResult} loading={false} status="completed" />);
    // Check if result panel is rendered (either by mock or real component)
    const resultPanel = document.querySelector('.result-panel') || screen.queryByTestId('result-display');
    expect(resultPanel).toBeInTheDocument();
  });

  it('错误 + 已有消息时不显示错误页（只显示消息）', () => {
    render(<ChatMessages messages={mockMessages} result={null} loading={false} error="API Key 无效" />);
    expect(screen.queryByText(/讨论未完成/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('message-bubble')).toHaveLength(2);
  });
});
