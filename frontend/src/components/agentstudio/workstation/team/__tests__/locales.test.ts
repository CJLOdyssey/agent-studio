import { describe, it, expect } from 'vitest';
import { t, setLang, getLang } from '../locales';

describe('team locales', () => {
  it('translates zh keys', () => {
    setLang('zh');
    expect(t('team.new')).toBe('新建团队');
    expect(t('team.edit')).toBe('编辑团队');
    expect(t('team.col_name')).toBe('团队名称');
    expect(t('team.status_active')).toBe('活跃');
  });

  it('translates en keys', () => {
    setLang('en');
    expect(t('team.new')).toBe('New Team');
    expect(t('team.edit')).toBe('Edit Team');
    expect(t('team.col_name')).toBe('Name');
  });

  it('returns key for unknown keys', () => {
    setLang('zh');
    expect(t('team.unknown')).toBe('team.unknown');
  });

  it('supports argument interpolation', () => {
    setLang('zh');
    expect(t('team.batch_delete', '3')).toBe('批量删除 (3)');
  });

  it('getLang returns current language', () => {
    setLang('zh');
    expect(getLang()).toBe('zh');
    setLang('en');
    expect(getLang()).toBe('en');
  });
});
