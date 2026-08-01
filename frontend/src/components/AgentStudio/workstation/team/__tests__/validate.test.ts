import { describe, it, expect, vi } from 'vitest';

vi.mock('../locales', () => ({
  t: (key: string) => {
    if (key === 'team.name_required') return 'Name is required';
    if (key === 'team.name_length') return 'Name must be 2-50 chars';
    return key;
  },
}));

import { validateTeamForm, EMPTY_FORM } from '../validate';

describe('validateTeamForm', { tags: ['unit'] }, () => {
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

  it('rejects duplicate name against items', () => {
    const errors = validateTeamForm({ name: 'My Team' }, [{ id: 't1', name: 'My Team' }]);
    expect(errors).toEqual(['名称「My Team」已存在']);
  });

  it('allows same name when editing itself', () => {
    const errors = validateTeamForm({ name: 'My Team' }, [{ id: 't1', name: 'My Team' }], 't1');
    expect(errors).toEqual([]);
  });

  it('rejects category with leading/trailing spaces', () => {
    const errors = validateTeamForm({ name: 'My Team', category: ' 业务 ' });
    expect(errors).toEqual(['分类首尾不能有空格']);
  });
});

describe('EMPTY_FORM', { tags: ['unit'] }, () => {
  it('has expected default values', () => {
    expect(EMPTY_FORM.name).toBe('');
    expect(EMPTY_FORM.description).toBe('');
    expect(EMPTY_FORM.status).toBe('active');
    expect(EMPTY_FORM.category).toBe('');
  });
});
