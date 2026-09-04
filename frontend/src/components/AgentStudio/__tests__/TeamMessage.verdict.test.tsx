import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));
vi.mock('../../../utils/sanitize', () => ({
  sanitizeHtml: (d: string) => d,
}));
vi.mock('../messages/CodeBlock', () => ({ CodeBlock: () => null }));
vi.mock('../messages/CopyBtn', () => ({ CopyBtn: () => null }));
vi.mock('../messages/LazyCodeBlock', () => ({ default: () => null }));
vi.mock('../../../api/client/instance', () => ({
  default: { post: vi.fn().mockResolvedValue({}) },
}));

import TeamMessage from '../TeamMessage';
import { useApprovalStore } from '../../../stores/streamHandler';
import type { Message, Agent } from '../../../types/AgentStudio';

const mockAgent: Agent = { id: 'a1', name: 'Writer', icon: 'Bot', color: '#6366f1' } as Agent;

function makeMsg(overrides: Record<string, unknown> = {}): Message {
  return { id: 'm1', role: 'agent', content: 'done', agentId: 'a1', ...overrides } as Message;
}

afterEach(() => {
  useApprovalStore.getState().setRequest(null);
  vi.clearAllMocks();
});

describe('TeamMessage verdicts', { tags: ['unit'] }, () => {
  it('renders verdict badges with role and rounds when verdicts present', () => {
    const { container } = render(
      <TeamMessage
        msg={makeMsg({
          verdicts: {
            writer: { role: 'writer', approved: true, rounds: 2 },
            reviewer: { role: 'reviewer', approved: false, rounds: 3 },
          },
          round: 3,
        })}
        allAgents={[mockAgent]}
      />,
    );
    expect(container.textContent).toContain('writer');
    expect(container.textContent).toContain('reviewer');
    expect(container.textContent).toContain('teamMessage.rounds');
    expect(container.textContent).toContain('teamMessage.totalRounds');
  });

  it('does not render verdict badges when verdicts missing', () => {
    const { container } = render(
      <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} />,
    );
    expect(container.textContent).not.toContain('teamMessage.rounds');
    expect(container.textContent).not.toContain('teamMessage.totalRounds');
  });
});
