import { describe, it, expect } from 'vitest';
import { validateMCPForm, EMPTY_FORM } from '../validate';
import type { MCPFormData } from '../mcp.types';

function makeForm(overrides: Partial<MCPFormData> = {}): MCPFormData {
  return { name: 'my-mcp', version: 'v1.0.0', type: 'stdio', command: 'node server.js', url: '', ...overrides, description: '', status: 'disconnected' };
}

describe('validateMCPForm', { tags: ['unit'] }, () => {
  it('returns no errors for valid stdio data', () => {
    const errors = validateMCPForm(makeForm(), []);
    expect(errors).toEqual([]);
  });

  it('returns no errors for valid sse data', () => {
    const errors = validateMCPForm(makeForm({ type: 'sse', command: '', url: 'http://localhost:3000' }), []);
    expect(errors).toEqual([]);
  });

  it('rejects empty name', () => {
    const errors = validateMCPForm(makeForm({ name: '   ' }), []);
    expect(errors).toContain('MCP 名称不能为空');
  });

  it('rejects name shorter than 2 chars', () => {
    const errors = validateMCPForm(makeForm({ name: 'a' }), []);
    expect(errors).toContain('MCP 名称至少 2 个字符');
  });

  it('rejects name longer than 50 chars', () => {
    const errors = validateMCPForm(makeForm({ name: 'a'.repeat(51) }), []);
    expect(errors).toContain('MCP 名称最多 50 个字符');
  });

  it('detects duplicate name', () => {
    const errors = validateMCPForm(makeForm({ name: 'existing' }), [
      { id: 'm1', name: 'existing' } as never,
    ]);
    expect(errors.some((e) => e.includes('已存在'))).toBe(true);
  });

  it('allows same name when editing same item', () => {
    const errors = validateMCPForm(makeForm({ name: 'my-name' }), [
      { id: 'editing-id', name: 'my-name' } as never,
    ], 'editing-id');
    expect(errors.filter((e) => e.includes('已存在'))).toHaveLength(0);
  });

  it('rejects invalid version format', () => {
    const errors = validateMCPForm(makeForm({ version: '1.0.0' }), []);
    expect(errors).toContain('版本格式应为 v1.0.0');
  });

  it('accepts valid version v2.1.0', () => {
    const errors = validateMCPForm(makeForm({ version: 'v2.1.0' }), []);
    expect(errors).toHaveLength(0);
  });

  it('requires command for stdio type', () => {
    const errors = validateMCPForm(makeForm({ type: 'stdio', command: '   ' }), []);
    expect(errors).toContain('stdio 类型需要填写启动命令');
  });

  it('requires url for sse type', () => {
    const errors = validateMCPForm(makeForm({ type: 'sse', url: '   ' }), []);
    expect(errors).toContain('sse 类型需要填写服务地址');
  });
});

describe('EMPTY_FORM', { tags: ['unit'] }, () => {
  it('has expected default values', () => {
    expect(EMPTY_FORM.name).toBe('');
    expect(EMPTY_FORM.type).toBe('stdio');
    expect(EMPTY_FORM.status).toBe('disconnected');
    expect(EMPTY_FORM.version).toBe('v1.0.0');
  });
});
