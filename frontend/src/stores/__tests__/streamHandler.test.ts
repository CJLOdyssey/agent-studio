import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('./uid', () => ({ uid: vi.fn(() => 'uid-fixed') }));

import {
  handleStreamStart,
  handleStreamEvent,
  handleThinkingStreamNew,
  handleThinkingStreamEvent,
} from '../streamHandler';

function makeMsg(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    role: 'agent' as const,
    content: 'content' + id,
    thinking: 'think' + id,
    agent_name: 'Agent',
    round_number: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    currentRunId: 'run-1',
    streamingId: null,
    messages: [],
    status: 'streaming',
    currentRole: null,
    wsStatus: 'connected',
    skipThinking: false,
    continuingId: null,
    pendingVersions: null,
    pendingThinkingVersions: null,
    ...overrides,
  };
}

describe('handleStreamStart', () => {
  it('creates new message with chunk when no continuingId', () => {
    const s = makeState();
    const msg = { type: 'stream' as const, content: '', agent_name: 'Bot' };
    const result = handleStreamStart(s as never, msg, 'hello');

    expect(result.streamingId).toBeDefined();
    expect(result.messages![0].content).toBe('hello');
    expect(result.messages![0].agent_name).toBe('Bot');
    expect(result.currentRole).toBe('Bot');
  });

  it('defaults agent name to Agent', () => {
    const s = makeState();
    const result = handleStreamStart(s as never, { type: 'stream' }, 'hi');

    expect(result.messages![0].agent_name).toBe('Agent');
  });

  it('replaces continuing message when continuingId present', () => {
    const s = makeState({
      continuingId: 'msg-1',
      messages: [makeMsg('msg-1', { content: 'interrupted', thinking: 'was thinking' })],
    });

    const result = handleStreamStart(s as never, { type: 'stream', agent_name: 'Bot' }, ' continues');

    expect(result.continuingId).toBeNull();
    expect(result.messages![0].content).toBe('interrupted continues');
    expect(result.messages![0].agent_name).toBe('Agent');
  });

  it('handles pendingVersions during continuation', () => {
    const s = makeState({
      continuingId: 'msg-1',
      pendingVersions: ['v1'],
      pendingThinkingVersions: ['t1'],
      messages: [makeMsg('msg-1', { content: 'old', thinking: 'old-think' })],
    });

    const result = handleStreamStart(s as never, { type: 'stream' }, ' new');

    expect(result.pendingVersions).toBeNull();
    expect(result.messages![0].versions).toBeDefined();
    expect(result.messages![0].versions![0]).toBe('old');
  });

  it('handles pendingVersions for new stream (no continuingId)', () => {
    const s = makeState({
      pendingVersions: ['v0'],
      pendingThinkingVersions: ['t0'],
    });

    const result = handleStreamStart(s as never, { type: 'stream' }, 'first');

    expect(result.messages![0].versions).toBeDefined();
    expect(result.messages![0].versions).toEqual(['v0', 'first']);
  });
});

describe('handleStreamEvent', () => {
  it('appends chunk to existing streaming message', () => {
    const s = makeState({
      streamingId: 'msg-1',
      currentRunId: 'run-1',
      messages: [makeMsg('msg-1', { content: 'Hello' })],
    });
    const get = vi.fn(() => s);
    const set = vi.fn((fn: (state: typeof s) => Partial<typeof s>) => fn(s));
    const activeStreams = new Set<string>(['run-1']);

    handleStreamEvent(set as never, get, activeStreams, { type: 'stream', content: ' world' } as never);

    const updateFn = set.mock.calls[0][0] as (state: typeof s) => Partial<typeof s>;
    const result = updateFn(s) as { messages: Array<{ content: string }> };
    expect(result.messages![0].content).toBe('Hello world');
  });

  it('returns early when chunk is empty', () => {
    const s = makeState({ streamingId: 'msg-1' });
    const get = vi.fn(() => s);
    const set = vi.fn();
    const activeStreams = new Set<string>();

    handleStreamEvent(set as never, get, activeStreams, { type: 'stream', content: '' } as never);

    expect(set).not.toHaveBeenCalled();
  });

  it('starts new stream when not active', () => {
    const s = makeState({
      currentRunId: 'run-1',
      messages: [],
    });
    const get = vi.fn(() => s);
    const set = vi.fn((fn: (state: typeof s) => Partial<typeof s>) => fn(s));
    const activeStreams = new Set<string>();

    handleStreamEvent(set as never, get, activeStreams, { type: 'stream', content: 'hi' } as never);

    expect(activeStreams.has('run-1')).toBe(true);

    const updateFn = set.mock.calls[0][0] as (state: typeof s) => Partial<typeof s>;
    const result = updateFn(s) as { messages: Array<{ content: string }> };
    expect(result.messages![0].content).toBe('hi');
  });

  it('returns empty state when active but no streamingId', () => {
    const s = makeState({ streamingId: null, currentRunId: 'run-1' });
    const get = vi.fn(() => s);
    const set = vi.fn((fn: (state: typeof s) => Partial<typeof s>) => {
      fn(s);
      return {};
    });
    const activeStreams = new Set<string>(['run-1']);

    handleStreamEvent(set as never, get, activeStreams, { type: 'stream', content: 'x' } as never);

    expect(set).toHaveBeenCalled();
  });
});

describe('handleThinkingStreamNew', () => {
  it('creates new message with thinking chunk', () => {
    const s = makeState();
    const result = handleThinkingStreamNew(s as never, { type: 'thinking_stream', agent_name: 'Bot' }, 'think content');

    expect(result.messages![0].thinking).toBe('think content');
    expect(result.messages![0].content).toBe('');
    expect(result.currentRole).toBe('Bot');
  });

  it('replaces continuing message with accumulated thinking', () => {
    const s = makeState({
      continuingId: 'msg-1',
      messages: [makeMsg('msg-1', { thinking: 'old-think' })],
    });

    const result = handleThinkingStreamNew(s as never, { type: 'thinking_stream' }, ' more');

    expect(result.continuingId).toBeNull();
    expect(result.messages![0].thinking).toBe('old-think more');
  });

  it('handles pendingVersions during new thinking stream', () => {
    const s = makeState({
      pendingVersions: ['v0'],
      pendingThinkingVersions: ['t0'],
    });

    const result = handleThinkingStreamNew(s as never, { type: 'thinking_stream' }, 'new-think');

    expect(result.messages![0].versions).toBeDefined();
    expect(result.messages![0].thinkingVersions).toBeDefined();
    expect(result.messages![0].thinkingVersions).toEqual(['t0', 'new-think']);
  });
});

describe('handleThinkingStreamEvent', () => {
  it('appends to thinking on active stream', () => {
    const s = makeState({
      streamingId: 'msg-1',
      currentRunId: 'run-1',
      messages: [makeMsg('msg-1', { thinking: 'existing' })],
    });
    const get = vi.fn(() => s);
    const set = vi.fn((fn: (state: typeof s) => Partial<typeof s>) => fn(s));
    const activeStreams = new Set<string>(['run-1']);

    handleThinkingStreamEvent(set as never, get, activeStreams, { type: 'thinking_stream', content: ' more' } as never);

    const updateFn = set.mock.calls[0][0] as (state: typeof s) => Partial<typeof s>;
    const result = updateFn(s) as { messages: Array<{ thinking: string }> };
    expect(result.messages![0].thinking).toBe('existing more');
  });

  it('returns early when chunk is empty', () => {
    const s = makeState({ streamingId: 'msg-1' });
    const get = vi.fn(() => s);
    const set = vi.fn();
    const activeStreams = new Set<string>();

    handleThinkingStreamEvent(set as never, get, activeStreams, { type: 'thinking_stream', content: '' } as never);

    expect(set).not.toHaveBeenCalled();
  });

  it('starts new thinking stream when not active', () => {
    const s = makeState({
      currentRunId: 'run-1',
      streamingId: null,
      messages: [],
    });
    const get = vi.fn(() => s);
    const set = vi.fn((fn: (state: typeof s) => Partial<typeof s>) => fn(s));
    const activeStreams = new Set<string>();

    handleThinkingStreamEvent(set as never, get, activeStreams, { type: 'thinking_stream', content: 'think' } as never);

    expect(activeStreams.has('run-1')).toBe(true);
  });

  it('appends to thinking when active stream has existing streamingId', () => {
    const s = makeState({
      streamingId: 'msg-1',
      currentRunId: 'run-1',
      messages: [makeMsg('msg-1', { thinking: null })],
    });
    const get = vi.fn(() => s);
    const set = vi.fn((fn: (state: typeof s) => Partial<typeof s>) => fn(s));
    const activeStreams = new Set<string>(['run-1']);

    handleThinkingStreamEvent(set as never, get, activeStreams, { type: 'thinking_stream', content: 'new' } as never);

    const updateFn = set.mock.calls[0][0] as (state: typeof s) => Partial<typeof s>;
    const result = updateFn(s) as { messages: Array<{ thinking: string }> };
    expect(result.messages![0].thinking).toBe('new');
  });
});
