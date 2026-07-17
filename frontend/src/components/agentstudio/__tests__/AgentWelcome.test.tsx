import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../test/setup';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'agent.startChat') return `开始与${options?.name || ''}对话`;
      if (key === 'agent.welcome') return '欢迎消息';
      if (key === 'common.close') return '关闭';
      return key;
    },
  }),
}));

import AgentWelcome from '../AgentWelcome';

describe('AgentWelcome', () => {
  it('renders welcome with agent icon when agent is provided', () => {
    const MockIcon = () => <span data-testid="agent-icon">Icon</span>;
    const agent = {
      id: '1',
      name: 'TestAgent',
      icon: MockIcon,
      color: 'text-blue-500',
    };

    render(
      <TestProviders>
        <AgentWelcome agent={agent} />
      </TestProviders>,
    );

    expect(screen.getByText('开始与TestAgent对话')).toBeTruthy();
    expect(screen.getByText('欢迎消息')).toBeTruthy();
    expect(screen.getByTestId('agent-icon')).toBeTruthy();
  });

  it('renders Bot icon when agent is undefined', () => {
    render(
      <TestProviders>
        <AgentWelcome agent={undefined} />
      </TestProviders>,
    );

    expect(screen.getByText('开始与对话')).toBeTruthy();
  });

  it('hides when dismiss button is clicked', () => {
    const MockIcon = () => <span>Icon</span>;
    const agent = {
      id: '1',
      name: 'Agent',
      icon: MockIcon,
      color: 'text-green-500',
    };

    const { container } = render(
      <TestProviders>
        <AgentWelcome agent={agent} />
      </TestProviders>,
    );

    const closeButton = container.querySelector('.agentstudio-welcome-close');
    fireEvent.click(closeButton!);

    expect(screen.queryByText('开始与Agent对话')).toBeNull();
  });
});
