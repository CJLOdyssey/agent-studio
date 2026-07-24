import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

const mockMsg: Message = {
  id: 'm1', role: 'agent', content: 'Hello from agent',
  agent_name: 'TestAgent', round_number: 1,
  createdAt: '2024-01-15T10:00:00Z',
  agentId: 'a1',
} as Message;

const mockAgent: Agent = { id: 'a1', name: 'TestAgent', icon: 'Bot', color: '#6366f1' } as Agent;

function makeMsg(overrides: Partial<Message> = {}): Message {
  return { id: 'm1', role: 'agent', content: 'Hello', agentId: 'a1', ...overrides } as Message;
}

describe('TeamMessage', () => {
  it('renders message content', () => {
    const { container } = render(
      <TeamMessage msg={mockMsg} allAgents={[mockAgent]} />
    );
    expect(container.textContent).toContain('Hello from agent');
  });

  describe('agent typing state', () => {
    it('shows typing indicator when isTyping is true', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ isTyping: true, content: '' })} allAgents={[mockAgent]} />
      );
      expect(container.textContent).toContain('agent.thinking');
    });

    it('does not render plan or content when typing', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ isTyping: true, content: '', plan: [{ step: 'A', status: 'completed' }] })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('.agentstudio-process-panel')).toBeNull();
    });
  });

  describe('plan steps', () => {
    it('renders plan header with step count', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ plan: [{ step: 'Init', status: 'completed' }, { step: 'Run', status: 'running' }] })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.textContent).toContain('teamMessage.executeTask');
    });

    it('renders completed step with check icon', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ plan: [{ step: 'Done', status: 'completed' }] })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('.agentstudio-process-step')).toBeInTheDocument();
    });

    it('renders running step with spinner', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ plan: [{ step: 'Running', status: 'running' }] })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('.agentstudio-process-step')).toBeInTheDocument();
    });

    it('toggles plan expansion when header clicked', async () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ plan: [{ step: 'S1', status: 'completed' }] })}
          allAgents={[mockAgent]}
        />
      );
      const header = container.querySelector('.agentstudio-process-header') as HTMLElement;
      expect(container.querySelector('#process-steps')).toBeInTheDocument();
      await userEvent.click(header);
      expect(container.querySelector('#process-steps')).toBeNull();
    });
  });

  describe('action', () => {
    it('renders action label when action is present and no plan', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ action: { type: 'tool', label: 'Searching...' } })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.textContent).toContain('Searching...');
    });

    it('does not render action when plan is also present', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({
            plan: [{ step: 'S', status: 'completed' }],
            action: { type: 'tool', label: 'Hidden' },
          })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.textContent).toContain('teamMessage.executeTask');
      expect(container.textContent).not.toContain('Hidden');
    });
  });

  describe('thinking block', () => {
    it('does not render thinking block when thinking is empty', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ thinking: '' })} allAgents={[mockAgent]} />
      );
      expect(container.querySelector('.ds-thinking-block')).toBeNull();
    });

    it('renders thinking complete state with expand button', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'thought content', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.textContent).toContain('teamMessage.thinkingComplete');
    });

    it('renders thinking stopped state when showContinue and not done', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'partial thought', thinkingDone: false })}
          allAgents={[mockAgent]}
          showContinue
        />
      );
      expect(container.textContent).toContain('teamMessage.thinkingStopped');
    });

    it('renders thinking pending state with spinner when in-progress', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'in progress...', thinkingDone: false })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.textContent).toContain('teamMessage.thinkingPending');
    });

    it('shows thinking nodes for multi-paragraph thinking', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'Para A\n\nPara B\n\nPara C', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelectorAll('.ds-think-node').length).toBe(3);
    });

    it('toggles thinking expansion when header clicked', async () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'thought', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
      const header = container.querySelector('.ds-thinking-header') as HTMLElement;
      expect(container.querySelector('.ds-thinking-body')).toBeInTheDocument();
      await userEvent.click(header);
      expect(container.querySelector('.ds-thinking-body')).toBeNull();
    });

    it('thinking stopped header is not clickable (no toggle)', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'partial', thinkingDone: false })}
          allAgents={[mockAgent]}
          showContinue
        />
      );
      const header = container.querySelector('.ds-thinking-header') as HTMLElement;
      expect(header.style.cursor).toBe('default');
    });
  });

  describe('unknown agent fallback', () => {
    it('uses fallback agent info when agentId not found', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ agentId: 'nonexistent', isTyping: true, content: '' })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.textContent).toContain('agent.thinking');
    });
  });

  describe('agent message time', () => {
    it('shows time when timestamp is present', () => {
      const ts = Date.now();
      const { container } = render(
        <TeamMessage msg={makeMsg({ timestamp: ts })} allAgents={[mockAgent]} />
      );
      expect(container.querySelector('.agentstudio-message-time')).toBeInTheDocument();
    });

    it('does not show time when timestamp is missing', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ timestamp: undefined })} allAgents={[mockAgent]} />
      );
      expect(container.querySelector('.agentstudio-message-time')).toBeNull();
    });
  });
});
