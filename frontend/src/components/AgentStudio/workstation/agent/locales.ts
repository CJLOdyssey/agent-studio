import i18n from '../../../../i18n';

export type Lang = 'zh' | 'en';

export function t(key: string, ...args: string[]): string {
  let v: string = i18n.t(key) as string;
  if (!args.length) return v;
  let i = -1;
  return v.replace(/\{(\w+)\}/g, () => args[++i] ?? '');
}

const LANG_MAP: Record<string, string> = { zh: 'zh-CN', en: 'en-US' };

export function setLang(l: Lang): void {
  i18n.changeLanguage(LANG_MAP[l] || l);
}

export function getLang(): Lang {
  return i18n.language?.startsWith('zh') ? 'zh' : 'en';
}
