import { describe, it, expect, vi } from 'vitest';

vi.mock('../locales', () => ({
  t: (key: string) => {
    if (key === 'team.name_required') return 'Name is required';
    if (key === 'team.name_length') return 'Name must be 2-50 chars';
    return key;
  },
}));

import { validateTeamForm, EMPTY_FORM } from '../validate';

describe('validateTeamForm', () => {
  it('returns no errors for valid data', () => {
    const errors = validateTeamForm({ name: 'My Team' });
    expect(errors).toEqual([]);
  });

  it('rejects empty name', () => {
    const errors = validateTeamForm({ name: '   ' });
    expect(errors).toEqual(['Name is required']);
  });

  it('rejects name shorter than 2 chars', () => {
    const errors = validateTeamForm({ name: 'A' });
    expect(errors).toEqual(['Name must be 2-50 chars']);
  });

  it('rejects name longer than 50 chars', () => {
    const errors = validateTeamForm({ name: 'A'.repeat(51) });
    expect(errors).toEqual(['Name must be 2-50 chars']);
  });

  it('accepts name at minimum length', () => {
    const errors = validateTeamForm({ name: 'AB' });
    expect(errors).toEqual([]);
  });

  it('accepts name at maximum length', () => {
    const errors = validateTeamForm({ name: 'A'.repeat(50) });
    expect(errors).toEqual([]);
  });
});

describe('EMPTY_FORM', () => {
  it('has expected default values', () => {
    expect(EMPTY_FORM.name).toBe('');
    expect(EMPTY_FORM.description).toBe('');
    expect(EMPTY_FORM.status).toBe('active');
    expect(EMPTY_FORM.category).toBe('dev');
  });
});
