import { describe, it, expect } from 'vitest';
import { t, setLang } from '../locales';

describe('agent locales', () => {
  it('translates base keys', () => {
    setLang('zh');
    expect(t('agent.new')).toBe('创建 Agent');
    expect(t('agent.edit')).toBe('编辑 Agent');
    expect(t('agent.col_name')).toBe('Agent 名称');
    expect(t('agent.col_status')).toBe('状态');
  });

  it('translates to English', () => {
    setLang('en');
    expect(t('agent.new')).toBe('New Agent');
    expect(t('agent.edit')).toBe('Edit Agent');
    expect(t('agent.col_name')).toBe('Name');
    expect(t('agent.col_status')).toBe('Status');
  });

  it('handles argument interpolation', () => {
    setLang('zh');
    expect(t('agent.batch_delete', '5')).toBe('批量删除 (5)');
    expect(t('agent.empty_title', '')).toBe('暂无 Agent');
  });
});
