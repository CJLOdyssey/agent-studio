import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCrypto = vi.hoisted(() => {
  const encrypt = vi.fn();
  const decrypt = vi.fn();
  return {
    encrypt,
    decrypt,
    AES: { encrypt, decrypt },
    enc: { Hex: { stringify: vi.fn((s: unknown) => String(s)) } },
    PBKDF2: vi.fn(() => ({ toString: vi.fn(() => 'derived-key') })),
    lib: {
      WordArray: {
        create: vi.fn(() => ({ toString: vi.fn(() => 'checksum') })),
        random: vi.fn(() => ({ toString: vi.fn(() => 'random-salt') })),
      },
    },
  };
});

vi.mock('crypto-js', () => mockCrypto);

import { encryptAndStore, getAndDecrypt, removeEncrypted } from '../secureStorage';

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe('encryptAndStore', () => {
  it('encrypts and stores data with version header', () => {
    mockCrypto.AES.encrypt.mockReturnValue('encrypted-text');

    encryptAndStore('test-key', 'secret-data');

    const stored = localStorage.getItem('test-key');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.v).toBe(2);
    expect(parsed.d).toBe('encrypted-text');
    expect(parsed.c).toBeDefined();
  });

  it('falls back to plain text on encryption error', () => {
    mockCrypto.AES.encrypt.mockImplementation(() => {
      throw new Error('encryption failed');
    });

    encryptAndStore('test-key', 'secret-data');

    const stored = localStorage.getItem('test-key');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.fallback).toBe(true);
    expect(parsed.d).toBe('secret-data');
  });
});

describe('getAndDecrypt', () => {
  it('returns null when key does not exist', () => {
    const result = getAndDecrypt('nonexistent');
    expect(result).toBeNull();
  });

  it('decrypts versioned data', () => {
    mockCrypto.AES.decrypt.mockReturnValue({
      toString: vi.fn(() => 'decrypted-data'),
    });

    const payload = JSON.stringify({
      v: 2,
      d: 'encrypted-text',
      c: 'checksum',
    });
    localStorage.setItem('test-key', payload);

    const result = getAndDecrypt('test-key');
    expect(result).toBe('decrypted-data');
  });

  it('returns fallback data directly', () => {
    const payload = JSON.stringify({
      v: 2,
      d: 'plain-data',
      fallback: true,
    });
    localStorage.setItem('test-key', payload);

    const result = getAndDecrypt('test-key');
    expect(result).toBe('plain-data');
  });

  it('handles invalid JSON by returning raw value', () => {
    localStorage.setItem('test-key', 'not-json');

    const result = getAndDecrypt('test-key');
    expect(result).toBe('not-json');
  });
});

describe('removeEncrypted', () => {
  it('removes key from localStorage', () => {
    localStorage.setItem('test-key', 'value');
    removeEncrypted('test-key');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('does not throw when key does not exist', () => {
    expect(() => removeEncrypted('nonexistent')).not.toThrow();
  });
});
