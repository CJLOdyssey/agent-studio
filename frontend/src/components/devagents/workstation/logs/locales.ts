const langs: Record<string, [zh: string, en: string]> = {
  'logs.search_placeholder': ['搜索操作、详情、用户...', 'Search actions, details, users...'],
  'logs.all_levels': ['全部级别', 'All Levels'],
  'logs.all_modules': ['全部模块', 'All Modules'],
  'logs.col_time': ['时间', 'Time'],
  'logs.col_level': ['级别', 'Level'],
  'logs.col_module': ['模块', 'Module'],
  'logs.col_user': ['用户', 'User'],
  'logs.col_action': ['操作', 'Action'],
  'logs.col_details': ['详情', 'Details'],
  'logs.col_ip': ['IP 地址', 'IP'],
  'logs.pagination': ['共 {n} 条', '{n} total'],
  'logs.page_prev': ['上一页', 'Previous'],
  'logs.page_next': ['下一页', 'Next'],
  'logs.page_num': ['第 {n} 页', 'Page {n}'],
  'logs.empty': ['暂无日志记录', 'No log records'],
  'logs.loading': ['加载中...', 'Loading...'],
  'logs.error_render': ['模块出错了，请刷新页面重试', 'Module error, please refresh'],
};

let lang: 'zh' | 'en' = typeof navigator !== 'undefined' && navigator.language?.startsWith('zh') ? 'zh' : 'en';

export function t(key: string, ...args: string[]): string {
  const v = (langs[key] as [string, string] | undefined)?.[lang === 'zh' ? 0 : 1];
  if (!v) return key;
  if (!args.length) return v;
  let i = -1;
  return v.replace(/\{(\w+)\}/g, () => args[++i] ?? '');
}

export function setLang(l: 'zh' | 'en'): void { lang = l; }
export function getLang(): 'zh' | 'en' { return lang; }
