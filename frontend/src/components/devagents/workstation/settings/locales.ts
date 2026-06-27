const langs: Record<string, [zh: string, en: string]> = {
  'settings.title': ['系统设置', 'System Settings'],
  'settings.save': ['保存设置', 'Save Settings'],
  'settings.saved': ['已保存', 'Saved'],
  'settings.saved_msg': ['设置已成功保存', 'Settings saved successfully'],
  'settings.basic': ['基本设置', 'Basic'],
  'settings.notification': ['通知设置', 'Notification'],
  'settings.security': ['安全设置', 'Security'],
  'settings.integration': ['集成设置', 'Integration'],
  'settings.field_pageSize': ['每页显示条数', 'Items per page'],
  'settings.field_autoRefresh': ['启用自动刷新', 'Auto Refresh'],
  'settings.field_notifyAgentErr': ['Agent 异常通知', 'Agent Error Notification'],
  'settings.field_notifyDisconnect': ['MCP 断开通知', 'MCP Disconnect Notification'],
  'settings.field_notifyDaily': ['每日摘要报告', 'Daily Report'],
  'settings.field_notifyWebhook': ['Webhook URL', 'Webhook URL'],
  'settings.field_sessionTimeout': ['会话超时时间', 'Session Timeout'],
  'settings.field_maxLogin': ['最大登录尝试次数', 'Max Login Attempts'],
  'settings.field_auditLog': ['启用审计日志', 'Audit Log'],
  'settings.field_twoFactor': ['双因素认证', 'Two-Factor Auth'],
  'settings.field_npm': ['NPM 镜像源', 'NPM Registry'],
  'settings.field_docker': ['Docker 镜像源', 'Docker Registry'],
  'settings.field_aiProvider': ['AI 服务商', 'AI Provider'],
  'settings.field_aiEndpoint': ['AI API 端点', 'AI Endpoint'],
  'settings.loading': ['加载中...', 'Loading...'],
  'settings.error_render': ['模块出错了，请刷新页面重试', 'Module error, please refresh'],
  'settings.minutes': ['分钟', 'min'],
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
