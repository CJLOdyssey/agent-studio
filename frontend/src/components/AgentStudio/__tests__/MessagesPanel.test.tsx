import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type TeamMessageGlobals = {
  __lastEditMessageFn?: unknown;
  __lastRegenerateFn?: unknown;
  __lastSwitchUserVersionFn?: unknown;
  __lastSwitchAnswerFn?: unknown;
  __lastThumbsFeedbackFn?: unknown;
};
const globals = globalThis as TeamMessageGlobals;

function invoke(fn: unknown, ...args: unknown[]): void {
  (fn as (...a: unknown[]) => void)(...args);
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('./TeamMessage', () => ({ default: () => null }));
vi.mock('./GreetingAnimation', () => ({ default: () => null }));
vi.mock('../stores/chatStore', () => ({
  useChatStore: (s?: unknown) => {
    const state = { messages: [], isRunning: false, status: 'idle', error: null };
    return s ? s(state) : state;
  },
}));

import MessagesPanel from '../MessagesPanel';

const baseProps = {
  activeConvId: null, onRunSubmit: vi.fn(), onRunRetry: vi.fn(),
  onRunCancel: vi.fn(),
};

describe('MessagesPanel', { tags: ['integration'] }, () => {
  it('renders empty state', () => {
    const { container } = render(<MessagesPanel {...baseProps} />);
    expect(container).toBeDefined();
  });
});

const mockResolveUserVersionTarget = vi.fn();
const mockResolveAnswerVersionTarget = vi.fn();
const mockSetThumbsFeedback = vi.fn();

vi.mock('../../../stores/chatStore', () => {
  const impl = (selector?: (s: unknown) => unknown) => {
    const state = {
      interruptedMessageId: null,
      continuingId: null,
      resolveUserVersionTarget: mockResolveUserVersionTarget,
      resolveAnswerVersionTarget: mockResolveAnswerVersionTarget,
      setThumbsFeedback: mockSetThumbsFeedback,
    };
    return selector ? selector(state) : state;
  };
  impl.getState = () => ({
    interruptedMessageId: null,
    continuingId: null,
    resolveUserVersionTarget: mockResolveUserVersionTarget,
    resolveAnswerVersionTarget: mockResolveAnswerVersionTarget,
    setThumbsFeedback: mockSetThumbsFeedback,
  });
  return { useChatStore: impl };
});

vi.mock('../TeamMessage', () => ({
  default: ({ msg, onEditMessage, onRegenerate, onSwitchUserVersion, onSwitchAnswer, showContinue, isContinuing, onThumbsFeedback }: React.ComponentProps<typeof TeamMessage>) => {
    (globalThis as TeamMessageGlobals).__lastEditMessageFn = onEditMessage;
    (globalThis as TeamMessageGlobals).__lastRegenerateFn = onRegenerate;
    (globalThis as TeamMessageGlobals).__lastSwitchUserVersionFn = onSwitchUserVersion;
    (globalThis as TeamMessageGlobals).__lastSwitchAnswerFn = onSwitchAnswer;
    (globalThis as TeamMessageGlobals).__lastThumbsFeedbackFn = onThumbsFeedback;
    return (
      <div data-testid={`team-msg-${msg.id}`} data-show-continue={showContinue} data-is-continuing={isContinuing}>
        {msg.content}
      </div>
    );
  },
}));

vi.mock('../../../stores/chatActions', () => ({
  editAndRegenerate: vi.fn(),
  regenerateMessage: vi.fn(),
  continueGeneration: vi.fn(),
}));

import { editAndRegenerate, regenerateMessage } from '../../../stores/chatActions';
import type TeamMessage from '../TeamMessage';
import type { Agent, Message } from '../../../types/AgentStudio';
import type * as React from 'react';

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
    onSwitchBranch: vi.fn(),
    ...overrides,
  };
}

describe('MessagesPanel — correct props', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete globals.__lastEditMessageFn;
    delete globals.__lastRegenerateFn;
    delete globals.__lastSwitchUserVersionFn;
    delete globals.__lastSwitchAnswerFn;
    delete globals.__lastThumbsFeedbackFn;
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
      const inner = container.querySelector('[aria-live="polite"]');
      expect(inner).toBeDefined();
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

  it('handleEditMessage calls editAndRegenerate with msg id and content', () => {
    const msgs = [makeMsg('m1', { role: 'user' }), makeMsg('m2', { role: 'agent' })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    invoke(globals.__lastEditMessageFn, 'm1', 'new text');
    expect(editAndRegenerate).toHaveBeenCalledWith('m1', 'new text');
  });

  it('handleEditMessage triggers editAndRegenerate even without a following agent msg', () => {
    const msgs = [makeMsg('m1', { role: 'user' })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    invoke(globals.__lastEditMessageFn, 'm1', 'edited');
    expect(editAndRegenerate).toHaveBeenCalledWith('m1', 'edited');
  });

  it('handleEditMessage delegates to editAndRegenerate (missing msg handled inside the action)', () => {
    const msgs = [makeMsg('m1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    invoke(globals.__lastEditMessageFn, 'nonexistent', 'text');
    expect(editAndRegenerate).toHaveBeenCalledWith('nonexistent', 'text');
  });

  it('handleSwitchUserVersion resolves target run and switches branch', () => {
    mockResolveUserVersionTarget.mockReturnValue('run-b');
    const onSwitchBranch = vi.fn();
    const msgs = [makeMsg('v1', { role: 'user', userVersions: ['a', 'b'] })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
      onSwitchBranch,
    })} />);

    invoke(globals.__lastSwitchUserVersionFn, 'v1', 'prev');
    expect(mockResolveUserVersionTarget).toHaveBeenCalledWith('v1', 'prev');
    expect(onSwitchBranch).toHaveBeenCalledWith('run-b');
  });

  it('handleSwitchUserVersion no-op when resolve target is null', () => {
    mockResolveUserVersionTarget.mockReturnValue(null);
    const onSwitchBranch = vi.fn();
    const msgs = [makeMsg('v1', { role: 'user', userVersions: ['a', 'b'] })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
      onSwitchBranch,
    })} />);

    invoke(globals.__lastSwitchUserVersionFn, 'v1', 'prev');
    expect(mockResolveUserVersionTarget).toHaveBeenCalledWith('v1', 'prev');
    expect(onSwitchBranch).not.toHaveBeenCalled();
  });

  it('handleSwitchAnswerVersion resolves target run and switches branch', () => {
    mockResolveAnswerVersionTarget.mockReturnValue('run-a2');
    const onSwitchBranch = vi.fn();
    const msgs = [makeMsg('a1', { role: 'agent', answerVersions: ['a1', 'a2'], currentAnswerVersion: 0 })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
      onSwitchBranch,
    })} />);

    invoke(globals.__lastSwitchAnswerFn, 'a1', 'next');
    expect(mockResolveAnswerVersionTarget).toHaveBeenCalledWith('a1', 'next');
    expect(onSwitchBranch).toHaveBeenCalledWith('run-a2');
  });

  it('handleSwitchAnswerVersion no-op when resolve target is null', () => {
    mockResolveAnswerVersionTarget.mockReturnValue(null);
    const onSwitchBranch = vi.fn();
    const msgs = [makeMsg('a1', { role: 'agent', answerVersions: ['a1', 'a2'], currentAnswerVersion: 0 })];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
      onSwitchBranch,
    })} />);

    invoke(globals.__lastSwitchAnswerFn, 'a1', 'next');
    expect(mockResolveAnswerVersionTarget).toHaveBeenCalledWith('a1', 'next');
    expect(onSwitchBranch).not.toHaveBeenCalled();
  });

  it('handleRegenerate calls regenerateMessage', () => {
    const msgs = [makeMsg('r1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    invoke(globals.__lastRegenerateFn, 'r1');
    expect(regenerateMessage).toHaveBeenCalledWith(0);
  });

  it('handleThumbsFeedback calls mockSetThumbsFeedback', () => {
    const msgs = [makeMsg('fb1')];
    render(<MessagesPanel {...properBaseProps({
      showAgentChat: true,
      displayMessages: msgs,
    })} />);

    invoke(globals.__lastThumbsFeedbackFn, 'fb1', 'up');
    expect(mockSetThumbsFeedback).toHaveBeenCalledWith('fb1', 'up');
  });
});

describe('handler functions', { tags: ['integration'] }, () => {
    it('provides onEditMessage to TeamMessage', () => {
      const msgs = [makeMsg('edit-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect(globals.__lastEditMessageFn).toBeInstanceOf(Function);
    });

    it('provides onRegenerate to TeamMessage', () => {
      const msgs = [makeMsg('regen-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect(globals.__lastRegenerateFn).toBeInstanceOf(Function);
    });

    it('provides onThumbsFeedback to TeamMessage', () => {
      const msgs = [makeMsg('thumbs-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect(globals.__lastThumbsFeedbackFn).toBeInstanceOf(Function);
    });

    it('provides onSwitchAnswer to TeamMessage', () => {
      const msgs = [makeMsg('answer-1')];
      render(<MessagesPanel {...properBaseProps({
        showAgentChat: true,
        displayMessages: msgs,
      })} />);
      expect(globals.__lastSwitchAnswerFn).toBeInstanceOf(Function);
    });
  });
});
