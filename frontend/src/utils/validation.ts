const MAX_INPUT_LENGTH = 10000;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function validateInput(input: string): { valid: boolean; sanitized: string; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, sanitized: '', error: 'Input cannot be empty' };
  if (trimmed.length > MAX_INPUT_LENGTH) {
    return { valid: false, sanitized: '', error: `Input too long (max ${MAX_INPUT_LENGTH} characters)` };
  }
  const sanitized = trimmed.replace(CONTROL_CHARS, '');
  return { valid: true, sanitized };
}

export function sanitizeMessageContent(content: string): string {
  return content.replace(CONTROL_CHARS, '');
}
