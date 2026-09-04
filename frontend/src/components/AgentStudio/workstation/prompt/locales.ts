import i18n from '../../../../i18n';

type Lang = 'zh' | 'en';

export function t(key: string, params?: Record<string, string | number>): string {
  let v: string = i18n.t(key) as string;
  if (params) for (const [k, vv] of Object.entries(params)) v = v.replace(`{${k}}`, String(vv));
  return v;
}

const LANG_MAP: Record<string, string> = { zh: 'zh-CN', en: 'en-US' };

export function setLang(l: Lang): void {
  void i18n.changeLanguage(LANG_MAP[l] || l);
}

export function getLang(): Lang {
  return i18n.language?.startsWith('zh') ? 'zh' : 'en';
}
