/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from 'vitest';
import { validateToolForm, EMPTY_FORM } from '../validate';

describe('validateToolForm', { tags: ['unit'] }, () => {
  it('returns error for empty name', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: '' }, []);
    expect(errors).toContain('工具名称不能为空');
  });

  it('returns error for too short name', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'a' }, []);
    expect(errors).toContain('工具名称至少 2 个字符');
  });

  it('returns error for too long name', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'a'.repeat(51) }, []);
    expect(errors).toContain('工具名称最多 50 个字符');
  });

  it('returns error for duplicate name', () => {
    const items = [{ id: '1', name: 'MyTool' }] as any[];
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'MyTool' }, items);
    expect(errors).toContain('名称「MyTool」已存在');
  });

  it('allows duplicate name for same item (editing)', () => {
    const items = [{ id: '1', name: 'MyTool' }] as any[];
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'MyTool' }, items, '1');
    expect(errors).not.toContain('名称「MyTool」已存在');
  });

  it('returns error for invalid version format', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'Valid', version: 'abc' }, []);
    expect(errors).toContain('版本格式应为 v1.0.0');
  });

  it('allows empty version (optional field)', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', version: '' }, []);
    expect(errors).not.toContain('版本格式应为 v1.0.0');
  });

  it('returns error for empty description', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', description: '' }, []);
    expect(errors).toContain('工具描述不能为空');
  });

  it('returns error for whitespace-only description', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', description: '   ' }, []);
    expect(errors).toContain('工具描述不能为空');
  });

  it('returns error for invalid parameters JSON', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', parameters: '{not json' }, []);
    expect(errors).toContain('参数必须为合法 JSON');
  });

  it('allows valid parameters JSON', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', parameters: '{"type":"object","properties":{"q":{"type":"string"}}}' }, []);
    expect(errors).not.toContain('参数必须为合法 JSON');
  });

  it('returns error for category with surrounding whitespace', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', category: '自定义工具 ' }, []);
    expect(errors).toContain('分类首尾不能有空格');
  });

  it('returns no errors for valid form', () => {
    const errors = validateToolForm({ ...EMPTY_FORM, name: 'ValidName', description: 'A tool', version: 'v1.0.0' }, []);
    expect(errors).toHaveLength(0);
  });
});
