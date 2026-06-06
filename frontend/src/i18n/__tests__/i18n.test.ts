import { describe, it, expect } from 'vitest';
import zh from '../locales/zh-CN.json';
import en from '../locales/en-US.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? flattenKeys(v as Record<string, unknown>, key) : [key];
  });
}

describe('i18n', () => {
  const zhKeys = flattenKeys(zh);
  const enKeys = flattenKeys(en);

  it('zh-CN 和 en-US 的 key 数量一致', () => {
    expect(zhKeys.length).toBe(enKeys.length);
  });

  it('zh-CN 和 en-US 的 key 集合相同', () => {
    const missing = zhKeys.filter(k => !enKeys.includes(k));
    const extra = enKeys.filter(k => !zhKeys.includes(k));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it('所有翻译值不为空', () => {
    const check = (obj: Record<string, unknown>) => {
      Object.values(obj).forEach((v) => {
        if (typeof v === 'string') {
          expect(v.trim()).not.toBe('');
        } else if (typeof v === 'object' && v !== null) {
          check(v as Record<string, unknown>);
        }
      });
    };
    check(zh);
    check(en);
  });
});
