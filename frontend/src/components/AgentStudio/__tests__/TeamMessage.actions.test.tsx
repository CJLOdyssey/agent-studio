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

const mockAgent: Agent = { id: 'a1', name: 'TestAgent', icon: 'Bot', color: '#6366f1' } as Agent;

function makeMsg(overrides: Partial<Message> = {}): Message {
  return { id: 'm1', role: 'agent', content: 'Hello', agentId: 'a1', ...overrides } as Message;
}

describe('TeamMessage', { tags: ['unit'] }, () => {
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
});
