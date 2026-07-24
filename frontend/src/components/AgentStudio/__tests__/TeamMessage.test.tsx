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

// ── helper to build message objects ──
function makeMsg(overrides: Partial<Message> = {}): Message {
  return { id: 'm1', role: 'agent', content: 'Hello', agentId: 'a1', ...overrides } as Message;
}

describe('TeamMessage', { tags: ['integration'] }, () => {
  it('renders message content', () => {
    const { container } = render(
      <TeamMessage msg={mockMsg} allAgents={[mockAgent]} />
    );
    expect(container.textContent).toContain('Hello from agent');
  });

  // ────────────── user messages ──────────────
  describe('user messages', () => {
    it('renders user message content', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'Hello user' })} allAgents={[]} />
      );
      expect(container.textContent).toContain('Hello user');
    });

    it('does not show agent action buttons for user messages', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'test' })} allAgents={[]} />
      );
      expect(container.querySelector('.agentstudio-msg-regenerate')).toBeNull();
      expect(container.querySelector('.agentstudio-msg-thumb')).toBeNull();
    });

    it('shows edit button for user messages', () => {
      render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'edit me' })} allAgents={[]} />
      );
      expect(screen.getByLabelText('teamMessage.edit')).toBeInTheDocument();
    });

    it('enters edit mode when edit button is clicked', async () => {
      render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'edit me' })} allAgents={[]} />
      );
      await userEvent.click(screen.getByLabelText('teamMessage.edit'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('common.cancel')).toBeInTheDocument();
      expect(screen.getByText('common.send')).toBeInTheDocument();
    });

    it('exits edit mode when cancel is clicked', async () => {
      render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'edit me' })} allAgents={[]} />
      );
      await userEvent.click(screen.getByLabelText('teamMessage.edit'));
      await userEvent.click(screen.getByText('common.cancel'));
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('shows time when timestamp is present', () => {
      const ts = Date.now();
      const { container } = render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'x', timestamp: ts })} allAgents={[]} />
      );
      expect(container.querySelector('.agentstudio-message-time')).toBeInTheDocument();
    });

    it('does not show time when timestamp is missing', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'x', timestamp: undefined })} allAgents={[]} />
      );
      expect(container.querySelector('.agentstudio-message-time')).toBeNull();
    });

    it('prefills edit textarea with current message content', async () => {
      render(
        <TeamMessage msg={makeMsg({ role: 'user', content: 'prefill test' })} allAgents={[]} />
      );
      await userEvent.click(screen.getByLabelText('teamMessage.edit'));
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('prefill test');
    });

    it('calls onEditMessage when Enter is pressed in edit mode', async () => {
      const onEdit = vi.fn();
      render(
        <TeamMessage
          msg={makeMsg({ role: 'user', content: 'old text' })}
          allAgents={[]}
          onEditMessage={onEdit}
        />
      );
      await userEvent.click(screen.getByLabelText('teamMessage.edit'));
      const textarea = screen.getByRole('textbox');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'new text');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      expect(onEdit).toHaveBeenCalledWith('m1', 'new text');
    });

    it('exits edit mode on Escape key', async () => {
      render(
        <TeamMessage
          msg={makeMsg({ role: 'user', content: 'old text' })}
          allAgents={[]}
        />
      );
      await userEvent.click(screen.getByLabelText('teamMessage.edit'));
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Escape' });
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  // ────────────── typing state ──────────────
  describe('agent typing state', () => {
    it('shows typing indicator when isTyping is true', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ isTyping: true, content: '' })} allAgents={[mockAgent]} />
      );
      // The typing indicator span has the i18n key
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

  // ────────────── plan steps ──────────────
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
      // Initially expanded
      expect(container.querySelector('#process-steps')).toBeInTheDocument();
      await userEvent.click(header);
      // After collapse
      expect(container.querySelector('#process-steps')).toBeNull();
    });
  });

  // ────────────── action (no plan) ──────────────
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

  // ────────────── thinking block ──────────────
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
      // Initially expanded
      expect(container.querySelector('.ds-thinking-body')).toBeInTheDocument();
      await userEvent.click(header);
      // After collapse
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

  // ────────────── unknown agent fallback ──────────────
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

  // ────────────── version pagination ──────────────
  describe('version pagination', () => {
    it('shows version pagination when multiple versions', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ versions: ['v1', 'v2', 'v3'], currentVersion: 1 })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('.agentstudio-version-pagination')).toBeInTheDocument();
      expect(container.querySelector('.agentstudio-version-count')?.textContent).toBe('2/3');
    });

    it('does not show version pagination with single version', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ versions: ['v1'], currentVersion: 0 })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('.agentstudio-version-pagination')).toBeNull();
    });

    it('disables prev button at first version', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ versions: ['v1', 'v2'], currentVersion: 0 })}
          allAgents={[mockAgent]}
        />
      );
      const btns = container.querySelectorAll('.agentstudio-version-btn');
      expect(btns[0]).toBeDisabled();
      expect(btns[1]).not.toBeDisabled();
    });

    it('disables next button at last version', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ versions: ['v1', 'v2'], currentVersion: 1 })}
          allAgents={[mockAgent]}
        />
      );
      const btns = container.querySelectorAll('.agentstudio-version-btn');
      expect(btns[0]).not.toBeDisabled();
      expect(btns[1]).toBeDisabled();
    });

    it('calls onSwitchVersion with prev when prev button clicked', async () => {
      const onSwitch = vi.fn();
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ versions: ['v1', 'v2', 'v3'], currentVersion: 1 })}
          allAgents={[mockAgent]}
          onSwitchVersion={onSwitch}
        />
      );
      const btns = container.querySelectorAll('.agentstudio-version-btn');
      await userEvent.click(btns[0]);
      expect(onSwitch).toHaveBeenCalledWith('m1', 'prev');
    });

    it('calls onSwitchVersion with next when next button clicked', async () => {
      const onSwitch = vi.fn();
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ versions: ['v1', 'v2', 'v3'], currentVersion: 1 })}
          allAgents={[mockAgent]}
          onSwitchVersion={onSwitch}
        />
      );
      const btns = container.querySelectorAll('.agentstudio-version-btn');
      await userEvent.click(btns[1]);
      expect(onSwitch).toHaveBeenCalledWith('m1', 'next');
    });
  });

  // ────────────── continue / interrupted ──────────────
  describe('continue and interrupted states', () => {
    it('shows continue button when showContinue is true', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} showContinue />
      );
      expect(container.textContent).toContain('teamMessage.continue');
    });

    it('shows interrupted banner when showContinue and not continuing', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} showContinue />
      );
      expect(container.querySelector('.agentstudio-msg-interrupted')).toBeInTheDocument();
      expect(container.textContent).toContain('teamMessage.interrupted');
    });

    it('shows loading state on continue button when isContinuing', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} showContinue isContinuing />
      );
      expect(container.textContent).toContain('teamMessage.continuing');
      const btn = container.querySelector('.agentstudio-msg-continue') as HTMLButtonElement;
      expect(btn).toBeDisabled();
    });

    it('does not show interrupted banner when isContinuing', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} showContinue isContinuing />
      );
      expect(container.querySelector('.agentstudio-msg-interrupted')).toBeNull();
    });

    it('calls onContinue when continue button clicked', async () => {
      const onContinue = vi.fn();
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} showContinue onContinue={onContinue} />
      );
      const btn = container.querySelector('.agentstudio-msg-continue') as HTMLElement;
      await userEvent.click(btn);
      expect(onContinue).toHaveBeenCalled();
    });
  });

  // ────────────── thumbs feedback ──────────────
  describe('thumbs feedback', () => {
    it('renders thumbs up and down buttons for agent messages', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} />
      );
      expect(container.querySelector('.agentstudio-msg-thumb')).toBeInTheDocument();
    });

    it('adds active class when thumbsFeedback is up', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ thumbsFeedback: 'up' })} allAgents={[mockAgent]} />
      );
      const thumbs = container.querySelectorAll('.agentstudio-msg-thumb');
      expect(thumbs[0].className).toContain('active');
    });

    it('adds active class when thumbsFeedback is down', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ thumbsFeedback: 'down' })} allAgents={[mockAgent]} />
      );
      const thumbs = container.querySelectorAll('.agentstudio-msg-thumb');
      expect(thumbs[1].className).toContain('active');
    });

    it('calls onThumbsFeedback when thumbs up clicked', async () => {
      const onThumbs = vi.fn();
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} onThumbsFeedback={onThumbs} />
      );
      const thumbs = container.querySelectorAll('.agentstudio-msg-thumb');
      await userEvent.click(thumbs[0]);
      expect(onThumbs).toHaveBeenCalledWith('m1', 'up');
    });

    it('toggles thumbs up to down when already active', async () => {
      const onThumbs = vi.fn();
      const { container } = render(
        <TeamMessage msg={makeMsg({ thumbsFeedback: 'up' })} allAgents={[mockAgent]} onThumbsFeedback={onThumbs} />
      );
      const thumbs = container.querySelectorAll('.agentstudio-msg-thumb');
      await userEvent.click(thumbs[0]);
      expect(onThumbs).toHaveBeenCalledWith('m1', 'down');
    });
  });

  // ────────────── regenerate ──────────────
  describe('regenerate', () => {
    it('calls onRegenerate when regenerate button clicked', async () => {
      const onRegen = vi.fn();
      const { container } = render(
        <TeamMessage msg={makeMsg()} allAgents={[mockAgent]} onRegenerate={onRegen} />
      );
      const btn = container.querySelector('.agentstudio-msg-regenerate') as HTMLElement;
      await userEvent.click(btn);
      expect(onRegen).toHaveBeenCalledWith('m1');
    });
  });

  // ────────────── agent message time ──────────────
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
