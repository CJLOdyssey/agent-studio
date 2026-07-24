import { describe, it, expect } from 'vitest';
import { validateSkillForm } from '../validate';
import type { SkillFormData } from '../skill.types';

function makeForm(overrides: Partial<SkillFormData> = {}): SkillFormData {
  return { name: 'my-skill', version: 'v1.0.0', ...overrides };
}

describe('validateSkillForm', { tags: ['unit'] }, () => {
  it('returns no errors for valid data', () => {
    const errors = validateSkillForm(makeForm(), []);
    expect(errors).toEqual([]);
  });

  it('rejects empty name', () => {
    const errors = validateSkillForm(makeForm({ name: '   ' }), []);
    expect(errors).toContain('Skill 名称不能为空');
  });

  it('rejects name shorter than 2 chars', () => {
    const errors = validateSkillForm(makeForm({ name: 'a' }), []);
    expect(errors).toContain('Skill 名称至少 2 个字符');
  });

  it('rejects name longer than 50 chars', () => {
    const errors = validateSkillForm(makeForm({ name: 'a'.repeat(51) }), []);
    expect(errors).toContain('Skill 名称最多 50 个字符');
  });

  it('detects duplicate name', () => {
    const errors = validateSkillForm(makeForm({ name: 'existing-name' }), [
      { id: 's1', name: 'existing-name' } as never,
      { id: 's2', name: 'other' } as never,
    ]);
    expect(errors.some((e) => e.includes('已存在'))).toBe(true);
  });

  it('allows same name when editing same skill', () => {
    const errors = validateSkillForm(makeForm({ name: 'my-name' }), [
      { id: 'editing-id', name: 'my-name' } as never,
    ], 'editing-id');
    expect(errors.filter((e) => e.includes('已存在'))).toHaveLength(0);
  });

  it('rejects invalid version format', () => {
    const errors = validateSkillForm(makeForm({ version: '1.0.0' }), []);
    expect(errors).toContain('版本格式应为 v1.0.0');
  });

  it('accepts valid version format v1.0.0', () => {
    const errors = validateSkillForm(makeForm({ version: 'v2.3.1' }), []);
    expect(errors).toHaveLength(0);
  });

  it('rejects version v1.0', () => {
    const errors = validateSkillForm(makeForm({ version: 'v1.0' }), []);
    expect(errors).toContain('版本格式应为 v1.0.0');
  });
});
