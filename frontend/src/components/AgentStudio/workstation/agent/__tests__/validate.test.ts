import { describe, it, expect } from 'vitest';
import { validateForm } from '../validate';
import type { AgentEntry, AgentFormData } from '../agent.types';

describe('validateForm', { tags: ['unit'] }, () => {
  const baseData: AgentFormData = {
    name: 'TestAgent',
    description: '',
    team: '',
    model: '',
    status: 'stopped',
    version: 'v1.0.0',
    systemPromptId: 'sp1',
    toolIds: [],
    mcpIds: [],
    skillIds: [],
  };

  it('returns no errors for valid data', () => {
    const errors = validateForm(baseData, []);
    expect(errors).toHaveLength(0);
  });

  it('requires name', () => {
    const errors = validateForm({ ...baseData, name: '' }, []);
    expect(errors).toContain('Agent 名称不能为空');
  });

  it('requires name at least 2 chars', () => {
    const errors = validateForm({ ...baseData, name: 'A' }, []);
    expect(errors).toContain('Agent 名称至少 2 个字符');
  });

  it('requires name at most 30 chars', () => {
    const errors = validateForm({ ...baseData, name: 'A'.repeat(31) }, []);
    expect(errors).toContain('Agent 名称最多 30 个字符');
  });

  it('rejects duplicate names', () => {
    const existing: AgentEntry[] = [{
      id: 'a2', name: 'Existing', description: '', team: '', teams: [],
      model: '', status: 'stopped', version: 'v1.0.0', systemPromptId: '',
      toolIds: [], mcpIds: [], skillIds: [], createdAt: '',
    }];
    const errors = validateForm({ ...baseData, name: 'Existing' }, existing);
    expect(errors).toContain('名称「Existing」已存在');
  });

  it('allows duplicate name when editing same item', () => {
    const existing: AgentEntry[] = [{
      id: 'a1', name: 'TestAgent', description: '', team: '', teams: [],
      model: '', status: 'stopped', version: 'v1.0.0', systemPromptId: '',
      toolIds: [], mcpIds: [], skillIds: [], createdAt: '',
    }];
    const errors = validateForm({ ...baseData, name: 'TestAgent' }, existing, 'a1');
    expect(errors).not.toContain('名称「TestAgent」已存在');
  });

  it('requires valid version format', () => {
    const errors = validateForm({ ...baseData, version: '1.0' }, []);
    expect(errors).toContain('版本格式应为 v1.0.0');
  });

  it('requires systemPromptId', () => {
    const errors = validateForm({ ...baseData, systemPromptId: '' }, []);
    expect(errors).toContain('请选择系统提示词');
  });
});
