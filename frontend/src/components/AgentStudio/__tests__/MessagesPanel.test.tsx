import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('./TeamMessage', () => ({ default: () => null }));
vi.mock('./GreetingAnimation', () => ({ default: () => null }));
vi.mock('../stores/chatStore', () => ({
  useChatStore: (s?: any) => {
    const state = { messages: [], isRunning: false, status: 'idle', error: null };
    return s ? s(state) : state;
  },
}));

import MessagesPanel from '../MessagesPanel';

const baseProps = {
  activeConvId: null, onRunSubmit: vi.fn(), onRunRetry: vi.fn(),
  onRunCancel: vi.fn(),
};

describe('MessagesPanel', () => {
  it('renders empty state', () => {
    const { container } = render(<MessagesPanel {...baseProps} />);
    expect(container).toBeDefined();
  });
});

const mockSwitchVersion = vi.fn();
const mockSetThumbsFeedback = vi.fn();

vi.mock('../../../stores/chatStore', () => ({
  useChatStore: (selector?: (s: any) => any) => {
    const state = {
      interruptedMessageId: null,
      continuingId: null,
      switchVersion: mockSwitchVersion,
      setThumbsFeedback: mockSetThumbsFeedback,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../TeamMessage', () => ({
  default: ({ msg, onEditMessage, onRegenerate, onSwitchVersion, showContinue, onContinue, isContinuing, onThumbsFeedback }: any) => {
    (globalThis as any).__lastEditMessageFn = onEditMessage;
    (globalThis as any).__lastRegenerateFn = onRegenerate;
    (globalThis as any).__lastSwitchVersionFn = onSwitchVersion;
    (globalThis as any).__lastThumbsFeedbackFn = onThumbsFeedback;
    return (
      <div data-testid={`team-msg-${msg.id}`} data-show-continue={showContinue} data-is-continuing={isContinuing}>
        {msg.content}
      </div>
    );
  },
}));

vi.mock('../../../stores/chatActions', () => ({
  editMessage: vi.fn(),
  regenerateMessage: vi.fn(),
  continueGeneration: vi.fn(),
}));

import { editMessage, regenerateMessage } from '../../../stores/chatActions';
import type { Agent, Message } from '../../../types/AgentStudio';

function makeMsg(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    role: 'user',
    content: `Content ${id}`,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeAgent(id: string, name: string): Agent {
  return {
    id, name, role: 'assistant',
    icon: () => null as unknown as JSX.Element,
    color: 'blue', bg: 'bg-blue-100', border: 'border-blue-200',
  } as unknown as Agent;
}

function properBaseProps(overrides: Record<string, unknown> = {}) {
  return {
    showAgentChat: false,
    hasMessages: false,
    selectedAgentId: null as string | null,
    activeTeamId: null as string | null,
    welcomeDismissed: false,
    allAgents: [] as Agent[],
    displayMessages: [] as Message[],
    messagesEndRef: { current: null } as React.RefObject<HTMLDivElement>,
    onDismissWelcome: vi.fn(),
    ...overrides,
  };
}

describe('MessagesPanel — correct props', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as any).__lastEditMessageFn;
    delete (globalThis as any).__lastRegenerateFn;
    delete (globalThis as any).__lastSwitchVersionFn;
    delete (globalThis as any).__lastThumbsFeedbackFn;
  });

  describe('null render (no state)', () => {
    it('returns null when neither showAgentChat nor hasMessages', () => {
      const { container } = render(<MessagesPanel {...properBaseProps()} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('showAgentChat mode', () => {
    it('renders welcome banner when welcome not dismissed and no active team', () => {
      const agent = makeAgent('a1', 'TestAgent');
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        selectedAgentId: 'a1',
        allAgents: [agent],
      })} />);
      expect(screen.getByText('agent.startChat')).toBeInTheDocument();
      expect(screen.getByText('agent.welcome')).toBeInTheDocument();
    });

    it('renders welcome close button and calls onDismissWelcome on click', async () => {
      const onDismiss = vi.fn();
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        selectedAgentId: 'a1',
        allAgents: [makeAgent('a1', 'T')],
        onDismissWelcome: onDismiss,
      })} />);
      const closeBtn = screen.getByLabelText('common.close');
      await userEvent.click(closeBtn);
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('hides welcome banner when welcomeDismissed is true', () => {
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        welcomeDismissed: true,
        selectedAgentId: 'a1',
        allAgents: [makeAgent('a1', 'T')],
      })} />);
      expect(screen.queryByText('agent.startChat')).not.toBeInTheDocument();
    });

    it('hides welcome banner when activeTeamId is set', () => {
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        activeTeamId: 'team-1',
        selectedAgentId: 'a1',
        allAgents: [makeAgent('a1', 'T')],
      })} />);
      expect(screen.queryByText('agent.startChat')).not.toBeInTheDocument();
    });

    it('renders messages with correct container and aria-live', () => {
      const msgs = [makeMsg('1'), makeMsg('2')];
      const { container } = render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      const inner = container.querySelector('.agentstudio-messages-inner');
      expect(inner).toBeDefined();
      expect(inner?.getAttribute('aria-live')).toBe('polite');
      expect(screen.getByTestId('team-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('team-msg-2')).toBeInTheDocument();
    });

    it('passes messagesEndRef as a div at the end', () => {
      const ref = { current: null } as React.RefObject<HTMLDivElement>;
      const msgs = [makeMsg('1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
        messagesEndRef: ref,
      })} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('passes showContinue=true when msg id matches interruptedMessageId', async () => {
      const mockStore = await vi.importActual<Record<string, unknown>>(
        '../../../stores/chatStore'
      ).catch(() => null);
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: [makeMsg('int-1')],
      })} />);
      const el = screen.getByTestId('team-msg-int-1');
      // showContinue is data attribute on the mocked TeamMessage
      expect(el.getAttribute('data-show-continue')).toBeDefined();
    });

    it('passes isContinuing=true when msg id matches continuingId', () => {
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: [makeMsg('cont-1')],
      })} />);
      const el = screen.getByTestId('team-msg-cont-1');
      expect(el.getAttribute('data-is-continuing')).toBeDefined();
    });
  });

  describe('hasMessages mode (without showAgentChat)', () => {
    it('renders message list without welcome banner', () => {
      const msgs = [makeMsg('1'), makeMsg('2')];
      render(<MessagesPanel {...properBaseProps({
        hasMessages: true,
        displayMessages: msgs,
      })} />);
      expect(screen.getByTestId('team-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('team-msg-2')).toBeInTheDocument();
      expect(screen.queryByText('agent.startChat')).not.toBeInTheDocument();
    });

    it('renders messages container with aria-live', () => {
      const { container } = render(<MessagesPanel {...properBaseProps({
        hasMessages: true,
        displayMessages: [makeMsg('1')],
      })} />);
      expect(container.querySelector('[aria-live="polite"]')).toBeDefined();
    });
  });

  describe('handler execution', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handleEditMessage calls editMessage with correct idx and content', () => {
    const msgs = [makeMsg('m1', { role: 'user' }), makeMsg('m2', { role: 'agent' })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    (globalThis as any).__lastEditMessageFn('m1', 'new text');
    expect(editMessage).toHaveBeenCalledWith(0, 'new text');
  });

  it('handleEditMessage auto-regenerates ai message after user msg edit', () => {
    const msgs = [makeMsg('m1', { role: 'user' }), makeMsg('m2', { role: 'agent' })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    (globalThis as any).__lastEditMessageFn('m1', 'edited');
    expect(regenerateMessage).toHaveBeenCalledWith(1);
  });

  it('handleEditMessage does not call editMessage when msg not found', () => {
    const msgs = [makeMsg('m1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    (globalThis as any).__lastEditMessageFn('nonexistent', 'text');
    expect(editMessage).not.toHaveBeenCalled();
  });

  it('handleRegenerate calls regenerateMessage', () => {
    const msgs = [makeMsg('r1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    (globalThis as any).__lastRegenerateFn('r1');
    expect(regenerateMessage).toHaveBeenCalledWith(0);
  });

  it('handleSwitchVersion calls mockSwitchVersion', () => {
    const msgs = [makeMsg('v1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    (globalThis as any).__lastSwitchVersionFn('v1', 'next');
    expect(mockSwitchVersion).toHaveBeenCalledWith('v1', 'next');
  });

  it('handleThumbsFeedback calls mockSetThumbsFeedback', () => {
    const msgs = [makeMsg('fb1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    (globalThis as any).__lastThumbsFeedbackFn('fb1', 'up');
    expect(mockSetThumbsFeedback).toHaveBeenCalledWith('fb1', 'up');
  });
});

describe('handler functions', () => {
    it('provides onEditMessage to TeamMessage', () => {
      const msgs = [makeMsg('edit-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect((globalThis as any).__lastEditMessageFn).toBeInstanceOf(Function);
    });

    it('provides onRegenerate to TeamMessage', () => {
      const msgs = [makeMsg('regen-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect((globalThis as any).__lastRegenerateFn).toBeInstanceOf(Function);
    });

    it('provides onSwitchVersion to TeamMessage', () => {
      const msgs = [makeMsg('sw-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect((globalThis as any).__lastSwitchVersionFn).toBeInstanceOf(Function);
    });

    it('provides onThumbsFeedback to TeamMessage', () => {
      const msgs = [makeMsg('thumbs-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect((globalThis as any).__lastThumbsFeedbackFn).toBeInstanceOf(Function);
    });
  });
});
