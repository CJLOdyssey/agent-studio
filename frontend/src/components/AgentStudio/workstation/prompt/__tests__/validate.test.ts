import { describe, it, expect } from 'vitest';
import { validatePromptForm } from '../validate';
import type { PromptEntry, PromptFormData } from '../types';

describe('validatePromptForm', () => {
  const baseData: PromptFormData = {
    name: 'TestPrompt',
    content: 'Hello world',
    category: 'system',
    version: 'v1.0.0',
  };

  it('returns no errors for valid data', () => {
    const errors = validatePromptForm(baseData, []);
    expect(errors).toHaveLength(0);
  });

  it('requires name', () => {
    const errors = validatePromptForm({ ...baseData, name: '' }, []);
    expect(errors).toContain('提示词名称不能为空');
  });

  it('requires name at least 2 chars', () => {
    const errors = validatePromptForm({ ...baseData, name: 'A' }, []);
    expect(errors).toContain('提示词名称至少 2 个字符');
  });

  it('requires name at most 50 chars', () => {
    const errors = validatePromptForm({ ...baseData, name: 'A'.repeat(51) }, []);
    expect(errors).toContain('提示词名称最多 50 个字符');
  });

  it('rejects duplicate names', () => {
    const items: PromptEntry[] = [{
      id: 'p2', name: 'Existing', content: '', category: 'system',
      model: '', status: 'active', version: 'v1.0.0', createdAt: '',
    }];
    const errors = validatePromptForm({ ...baseData, name: 'Existing' }, items);
    expect(errors).toContain('名称「Existing」已存在');
  });

  it('allows duplicate name for same item when editing', () => {
    const items: PromptEntry[] = [{
      id: 'p1', name: 'TestPrompt', content: '', category: 'system',
      model: '', status: 'active', version: 'v1.0.0', createdAt: '',
    }];
    const errors = validatePromptForm({ ...baseData }, items, 'p1');
    expect(errors).not.toContain('名称「TestPrompt」已存在');
  });

  it('requires content', () => {
    const errors = validatePromptForm({ ...baseData, content: '' }, []);
    expect(errors).toContain('提示词内容不能为空');
  });

  it('requires valid version format', () => {
    const errors = validatePromptForm({ ...baseData, version: 'bad' }, []);
    expect(errors).toContain('版本格式应为 v1.0.0');
  });
});
