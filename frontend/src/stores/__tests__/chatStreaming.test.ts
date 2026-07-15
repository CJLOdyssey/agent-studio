import { describe, it, expect, vi } from 'vitest';
import { createStreamHandler } from '../chatStreaming';

describe('createStreamHandler', () => {
  const invokeSet = (set: ReturnType<typeof vi.fn>) => {
    const updater = set.mock.calls[0][0];
    return updater({});
  };

  it('handles balance_warning event by setting status=error and error message', () => {
    const set = vi.fn();
    const get = vi.fn();

    const handler = createStreamHandler(set, get);

    handler({ type: 'balance_warning', content: '模型余额不足，请检查 API Key 配置' });

    expect(invokeSet(set)).toEqual({
      status: 'error',
      error: '模型余额不足，请检查 API Key 配置',
      wsStatus: 'connected',
    });
  });

  it('uses default message when balance_warning has no content', () => {
    const set = vi.fn();
    const get = vi.fn();

    const handler = createStreamHandler(set, get);

    handler({ type: 'balance_warning' });

    expect(invokeSet(set)).toEqual({
      status: 'error',
      error: '模型余额不足',
      wsStatus: 'connected',
    });
  });

  it('does not affect messages or streamingId state', () => {
    const set = vi.fn();
    const get = vi.fn();

    const handler = createStreamHandler(set, get);

    handler({ type: 'balance_warning', content: '余额不足' });

    const result = invokeSet(set);
    expect(result).not.toHaveProperty('messages');
    expect(result).not.toHaveProperty('streamingId');
  });
});
