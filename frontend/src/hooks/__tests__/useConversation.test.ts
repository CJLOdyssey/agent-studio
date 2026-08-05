import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../stores/chatStore', () => ({
  useChatStore: {
    getState: vi.fn(() => ({ reset: vi.fn() })),
  },
}));

import { useConversation } from '../useConversation';

describe('useConversation', { tags: ['unit'] }, () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with null activeConvId when no stored value', () => {
    const { result } = renderHook(() => useConversation());
    expect(result.current.conversations).toEqual([]);
  });

  it('loads persisted conversations from localStorage', () => {
    const convs = [{
      id: 'conv-1',
      title: 'Test Conversation',
      messages: [{ role: 'user', content: 'hello', created_at: '2024-01-01T00:00:00Z' }],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T01:00:00Z',
    }];
    localStorage.setItem('agentstudio-conversations', JSON.stringify(convs));

    const { result } = renderHook(() => useConversation());
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe('Test Conversation');
  });

  it('returns empty array for invalid localStorage data', () => {
    localStorage.setItem('agentstudio-conversations', 'not-json');

    const { result } = renderHook(() => useConversation());
    expect(result.current.conversations).toEqual([]);
  });

  it('provides saveConversation function', () => {
    const { result } = renderHook(() => useConversation());

    act(() => {
      result.current.saveConversation('Title', [{ role: 'user', content: 'test' }]);
    });

    const convs = result.current.conversations;
    expect(convs).toHaveLength(1);
    expect(convs[0].title).toBe('Title');
  });

  it('saves two conversations', () => {
    const { result } = renderHook(() => useConversation());

    act(() => {
      result.current.saveConversation('First', [{ role: 'user', content: 'a' }]);
    });

    act(() => {
      result.current.saveConversation('Second', [{ role: 'user', content: 'b' }]);
    });

    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.conversations[0].title).toBe('Second');
    expect(result.current.conversations[1].title).toBe('First');
  });

  it('sets activeConvId on save', () => {
    const { result } = renderHook(() => useConversation());

    act(() => {
      result.current.saveConversation('Test', [{ role: 'user', content: 'x' }]);
    });

    expect(localStorage.getItem('agentstudio-active-conv-id')).toBeTruthy();
  });

  it('deletes conversation', () => {
    const { result } = renderHook(() => useConversation());

    let convId = '';
    act(() => {
      convId = result.current.saveConversation('ToDelete', [{ role: 'user', content: 'x' }]);
    });

    act(() => {
      result.current.deleteConversation(convId);
    });

    expect(result.current.conversations).toHaveLength(0);
  });

  it('deletes non-existent id gracefully', () => {
    const { result } = renderHook(() => useConversation());

    act(() => {
      result.current.saveConversation('Keep', [{ role: 'user', content: 'x' }]);
    });

    act(() => {
      result.current.deleteConversation('non-existent');
    });

    expect(result.current.conversations).toHaveLength(1);
  });

  it('updates conversation messages', () => {
    const { result } = renderHook(() => useConversation());

    let convId = '';
    act(() => {
      convId = result.current.saveConversation('Test', [{ role: 'user', content: 'a' }]);
    });

    act(() => {
      result.current.updateConversationMessages(convId, [{ role: 'user', content: 'b' }, { role: 'agent', content: 'c' }]);
    });

    const updated = result.current.conversations.find((c) => c.id === convId);
    expect(updated?.messages).toHaveLength(2);
  });

  it('immediately persists conversation to localStorage on save', () => {
    localStorage.clear();
    const { result } = renderHook(() => useConversation());

    act(() => {
      result.current.saveConversation('Persist Test', [{ role: 'user', content: 'hello' }]);
    });

    const raw = localStorage.getItem('agentstudio-conversations');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Persist Test');
  });

  it('immediately persists updated messages to localStorage', () => {
    localStorage.clear();
    const { result } = renderHook(() => useConversation());

    let convId = '';
    act(() => {
      convId = result.current.saveConversation('MsgSync', [{ role: 'user', content: 'a' }]);
    });

    act(() => {
      result.current.updateConversationMessages(convId, [
        { role: 'user', content: 'a' },
        { role: 'agent', content: 'reply' },
      ]);
    });

    const raw = localStorage.getItem('agentstudio-conversations');
    const parsed = JSON.parse(raw!);
    const conv = parsed.find((c: { id: string }) => c.id === convId);
    expect(conv?.messages).toHaveLength(2);
    expect(conv?.messages[1].content).toBe('reply');
  });

  it('immediately persists session ID to localStorage', () => {
    localStorage.clear();
    const { result } = renderHook(() => useConversation());

    let convId = '';
    act(() => {
      convId = result.current.saveConversation('SessionTest', []);
    });

    act(() => {
      result.current.updateConversationSessionId(convId, 'session-abc-123');
    });

    const raw = localStorage.getItem('agentstudio-conversations');
    const parsed = JSON.parse(raw!);
    const conv = parsed.find((c: { id: string }) => c.id === convId);
    expect(conv?.sessionId).toBe('session-abc-123');
  });
});
