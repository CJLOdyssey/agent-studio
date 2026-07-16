import { describe, it, expect, vi, beforeEach } from 'vitest';
import Logger, { debug, info, warn, error } from '../logger';

vi.mock('@sentry/browser', () => ({
  default: { captureMessage: vi.fn(), captureException: vi.fn() },
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('Logger', () => {
  it('debug calls console.debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    debug('test debug');
    expect(spy).toHaveBeenCalledWith('[DEBUG] test debug');
  });

  it('info calls console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    info('test info');
    expect(spy).toHaveBeenCalledWith('[INFO] test info');
  });

  it('warn calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn('test warn');
    expect(spy).toHaveBeenCalledWith('[WARN] test warn');
  });

  it('error calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    error('test error');
    expect(spy).toHaveBeenCalledWith('[ERROR] test error');
  });

  it('has default export with all methods', () => {
    expect(Logger.debug).toBeDefined();
    expect(Logger.info).toBeDefined();
    expect(Logger.warn).toBeDefined();
    expect(Logger.error).toBeDefined();
  });
});
