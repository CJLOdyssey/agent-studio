import i18n from '../../../../i18n';

export function t(key: string, ...args: string[]): string {
  let v: string = i18n.t(key) as string;
  if (!args.length) return v;
  let i = -1;
  return v.replace(/\{(\w+)\}/g, () => args[++i] ?? '');
}
