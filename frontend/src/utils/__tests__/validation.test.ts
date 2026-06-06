import { describe, it, expect } from 'vitest';
import { validateInput, sanitizeMessageContent } from '../validation';

describe('validateInput', () => {
  it('rejects empty input', () => {
    const result = validateInput('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Input cannot be empty');
  });

  it('rejects whitespace-only input', () => {
    const result = validateInput('   ');
    expect(result.valid).toBe(false);
  });

  it('rejects input exceeding max length', () => {
    const long = 'a'.repeat(10001);
    const result = validateInput(long);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('accepts valid input', () => {
    const result = validateInput('hello world');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('hello world');
  });

  it('strips control characters', () => {
    const result = validateInput('hello\x00world\x1F');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('helloworld');
  });

  it('trims whitespace', () => {
    const result = validateInput('  hello  ');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('hello');
  });
});

describe('sanitizeMessageContent', () => {
  it('passes through normal text', () => {
    expect(sanitizeMessageContent('hello world')).toBe('hello world');
  });

  it('removes null bytes', () => {
    expect(sanitizeMessageContent('hello\x00world')).toBe('helloworld');
  });

  it('removes control characters', () => {
    expect(sanitizeMessageContent('a\x01b\x1Fc')).toBe('abc');
  });

  it('preserves newlines and tabs', () => {
    expect(sanitizeMessageContent('line1\nline2\tindented')).toBe('line1\nline2\tindented');
  });
});
