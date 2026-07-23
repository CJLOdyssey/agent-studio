import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../messages/CodeBlock', () => ({ CodeBlock: () => null }));
vi.mock('../../messages/CopyBtn', () => ({ CopyBtn: () => null }));
vi.mock('../../messages/LazyCodeBlock', () => ({ default: () => null }));

import TeamMessage from '../TeamMessage';
import type { Message, Agent } from '../../../types/AgentStudio';

const mockMsg: Message = {
  id: 'm1', role: 'agent', content: 'Hello from agent',
  agent_name: 'TestAgent', round_number: 1,
  createdAt: '2024-01-15T10:00:00Z',
  agentId: 'a1',
} as Message;

const mockAgent: Agent = { id: 'a1', name: 'TestAgent', icon: 'Bot', color: '#6366f1' } as Agent;

describe('TeamMessage', () => {
  it('renders message content', () => {
    const { container } = render(
      <TeamMessage msg={mockMsg} allAgents={[mockAgent]} />
    );
    expect(container.textContent).toContain('Hello from agent');
  });
});
