import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../logger', () => mockLogger);

import { installGlobalErrorHandlers } from '../errorHandler';

describe('installGlobalErrorHandlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sets window.onerror handler', () => {
    installGlobalErrorHandlers();

    expect(window.onerror).toBeDefined();
    const error = new Error('test error');
    const result = window.onerror?.('test message', 'test.js', 10, 5, error);
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('Uncaught error', { message: 'test message', source: 'test.js', lineno: 10, colno: 5, error });
  });

  it('sets window.onunhandledrejection handler', () => {
    installGlobalErrorHandlers();

    expect(window.onunhandledrejection).toBeDefined();
  });

  it('is safe to call multiple times', () => {
    installGlobalErrorHandlers();
    installGlobalErrorHandlers();

    expect(window.onerror).toBeDefined();
  });
});
