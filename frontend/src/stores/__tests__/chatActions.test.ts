import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockListKeys, mockSubmitReq, mockResumeRun } = vi.hoisted(() => ({
  mockListKeys: vi.fn().mockResolvedValue([{ id: 'key-1', is_default: true, is_active: true, models: ['deepseek-chat'] }]),
  mockSubmitReq: vi.fn().mockResolvedValue({ run_id: 'run-1', status: 'running', session_id: 'sess-1' }),
  mockResumeRun: vi.fn().mockResolvedValue({ run_id: 'run-2', status: 'running', session_id: 'sess-1' }),
}));

vi.mock('../../api/websocket', () => ({
  connectRun: vi.fn(() => vi.fn()),
  disconnectRun: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  submitRequirement: mockSubmitReq,
  resumeRun: mockResumeRun,
  listKeys: mockListKeys,
  listAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock('../chatStreaming', () => ({ createStreamHandler: vi.fn(() => vi.fn()) }));

import { useChatStore } from '../chatStore';
import { editMessage, regenerateMessage, retry, continueGeneration } from '../chatActions';
import type { ChatMessage } from '../../types';

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user' as const,
    agent_name: '\u6211',
    content: 'test content',
    round_number: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const initialState = {
  currentRunId: null as string | null,
  currentSessionId: null as string | null,
  currentConvId: null as string | null,
  messages: [] as ChatMessage[],
  status: 'idle' as const,
  result: null,
  currentRole: null as string | null,
  error: null as string | null,
  streamingId: null as string | null,
  lastAbandonedRunId: null as string | null,
  interruptedMessageId: null as string | null,
  continuingId: null as string | null,
  skipThinking: false,
  pendingVersions: null as string[] | null,
  pendingThinkingVersions: null as string[] | null,
  agents: [],
  agentsLoaded: false,
  wsStatus: 'disconnected' as const,
  submissionConvId: null as string | null,
  activeTeamId: null as string | null,
  selectedAgentId: null as string | null,
};

beforeEach(() => {
  useChatStore.setState(initialState);
  vi.clearAllMocks();
  mockListKeys.mockResolvedValue([{ id: 'key-1', is_default: true, is_active: true, models: ['deepseek-chat'] }]);
  mockSubmitReq.mockResolvedValue({ run_id: 'run-1', status: 'running', session_id: 'sess-1' });
  mockResumeRun.mockResolvedValue({ run_id: 'run-2', status: 'running', session_id: 'sess-1' });
  localStorage.clear();
});

describe('editMessage', () => {
  it('updates content of message at given index', () => {
    const msg = makeMsg({ id: 'm1', content: 'old' });
    useChatStore.setState({ messages: [msg] });

    editMessage(0, 'new content');

    const updated = useChatStore.getState().messages[0];
    expect(updated.content).toBe('new content');
    expect(updated.id).toBe('m1');
  });

  it('handles out-of-bounds index by extending array', () => {
    const msg = makeMsg({ id: 'm1' });
    useChatStore.setState({ messages: [msg] });

    editMessage(5, 'new content');

    const messages = useChatStore.getState().messages;
    expect(messages).toHaveLength(6);
    expect(messages[5].content).toBe('new content');
    expect(messages[0].id).toBe('m1');
  });
});

describe('regenerateMessage', () => {
  it('does nothing if msgIndex < 1', async () => {
    const msg = makeMsg({ id: 'm2', content: 'hello' });
    useChatStore.setState({ messages: [msg], currentSessionId: 'sess-1' });

    await regenerateMessage(0);

    expect(mockSubmitReq).not.toHaveBeenCalled();
  });

  it('does nothing if user message at msgIndex-1 is missing', async () => {
    useChatStore.setState({ messages: [], currentSessionId: 'sess-1' });

    await regenerateMessage(1);

    expect(mockSubmitReq).not.toHaveBeenCalled();
  });

  it('disconnects current run, truncates messages, and re-submits', async () => {
    const { disconnectRun } = await import('../../api/websocket');
    const userMsg = makeMsg({ id: 'u1', role: 'user', content: 'original' });
    const agentMsg = makeMsg({ id: 'a1', role: 'agent', content: 'response' });
    useChatStore.setState({
      messages: [userMsg, agentMsg],
      currentSessionId: 'sess-1',
      currentRunId: 'old-run',
    });

    await regenerateMessage(1);

    expect(disconnectRun).toHaveBeenCalledWith('old-run');
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].id).toBe('u1');
    expect(mockSubmitReq).toHaveBeenCalledWith(
      'original',
      'sess-1',
      'key-1',
      'deepseek-chat',
      undefined,
      undefined,
    );
  });
});

describe('retry', () => {
  it('sets error if no user message found', async () => {
    useChatStore.setState({ messages: [], currentSessionId: 'sess-1' });

    await retry();

    const state = useChatStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('\u6ca1\u6709\u627e\u5230\u7528\u6237\u6d88\u606f\uff0c\u65e0\u6cd5\u91cd\u8bd5');
  });

  it('re-submits the last user message', async () => {
    const { connectRun } = await import('../../api/websocket');
    const msg1 = makeMsg({ id: 'u1', role: 'user', content: 'question' });
    const msg2 = makeMsg({ id: 'a1', role: 'agent', content: 'answer' });
    const msg3 = makeMsg({ id: 'u2', role: 'user', content: 'follow-up' });
    useChatStore.setState({
      messages: [msg1, msg2, msg3],
      currentSessionId: 'sess-1',
      currentRunId: 'old-run',
    });

    await retry();

    const state = useChatStore.getState();
    expect(state.currentRunId).toBe('run-1');
    expect(state.status).toBe('running');
    expect(mockSubmitReq).toHaveBeenCalledWith(
      'follow-up',
      'sess-1',
    );
    expect(connectRun).toHaveBeenCalled();
  });
});

describe('continueGeneration', () => {
  it('does nothing if interruptedMessageId is null', async () => {
    useChatStore.setState({ interruptedMessageId: null });

    await continueGeneration();

    expect(mockResumeRun).not.toHaveBeenCalled();
  });

  it('clears interruptedMessageId if message not found in list', async () => {
    useChatStore.setState({
      interruptedMessageId: 'missing-id',
      messages: [],
    });

    await continueGeneration();

    expect(useChatStore.getState().interruptedMessageId).toBeNull();
    expect(mockResumeRun).not.toHaveBeenCalled();
  });

  it('resumes run with continuation for interrupted message', async () => {
    const { connectRun } = await import('../../api/websocket');
    const interrupted = makeMsg({
      id: 'int-1',
      role: 'agent',
      content: 'partial response',
      thinking: 'some thinking',
    });
    useChatStore.setState({
      interruptedMessageId: 'int-1',
      messages: [interrupted],
      currentSessionId: 'sess-1',
      currentRunId: 'pending-run',
    });

    await continueGeneration();

    expect(mockResumeRun).toHaveBeenCalledWith('partial response', 'sess-1', 'some thinking');
    const state = useChatStore.getState();
    expect(state.currentRunId).toBe('run-2');
    expect(state.status).toBe('running');
    expect(connectRun).toHaveBeenCalled();
  });

  it('uses versions when available for pending state', async () => {
    const interrupted = makeMsg({
      id: 'int-2',
      role: 'agent',
      content: 'v2 content',
      thinking: undefined,
      versions: ['v1', 'v2'],
    } as Partial<ChatMessage> & { versions: string[] });
    useChatStore.setState({
      interruptedMessageId: 'int-2',
      messages: [interrupted],
      currentSessionId: 'sess-1',
    });

    await continueGeneration();

    const state = useChatStore.getState();
    expect(state.pendingVersions).toEqual(['v1', 'v2']);
    expect(state.pendingThinkingVersions).toBeNull();
  });

  it('handles error during resume', async () => {
    mockResumeRun.mockRejectedValueOnce(new Error('Resume failed'));
    const interrupted = makeMsg({ id: 'int-3', role: 'agent', content: 'partial' });
    useChatStore.setState({
      interruptedMessageId: 'int-3',
      messages: [interrupted],
      currentSessionId: 'sess-1',
    });

    await continueGeneration();

    const state = useChatStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('Resume failed');
  });

  it('handles non-Error error during resume', async () => {
    mockResumeRun.mockRejectedValueOnce('string error');
    const interrupted = makeMsg({ id: 'int-4', role: 'agent', content: 'partial' });
    useChatStore.setState({
      interruptedMessageId: 'int-4',
      messages: [interrupted],
      currentSessionId: 'sess-1',
    });

    await continueGeneration();

    expect(useChatStore.getState().error).toBe('string error');
  });
});
