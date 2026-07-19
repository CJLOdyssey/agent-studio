import { describe, it, expect } from 'vitest';
import { nextId, today } from '../utils';

describe('nextId', () => {
  it('returns 1 for empty array', () => {
    expect(nextId([])).toBe('1');
  });

  it('returns max+1 for existing items', () => {
    expect(nextId([{ id: '3' }, { id: '7' }, { id: '2' }])).toBe('8');
  });

  it('handles single item', () => {
    expect(nextId([{ id: '5' }])).toBe('6');
  });
});

describe('today', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
