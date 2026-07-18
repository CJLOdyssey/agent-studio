const langs: Record<string, [zh: string, en: string]> = {
  'monitor.title': ['系统监控面板', 'System Dashboard'],
  'monitor.activity': ['最近活动', 'Recent Activity'],
  'monitor.health': ['系统健康', 'System Health'],
  'monitor.flat': ['持平', 'Flat'],
  'monitor.today': ['{delta} 今日', '{delta} today'],
  'monitor.time': ['当前时间', 'Current Time'],
  'monitor.loading': ['加载中...', 'Loading...'],
  'monitor.error_render': ['模块出错了，请刷新页面重试', 'Module error, please refresh'],
  'monitor.health_status': ['系统状态', 'System Status'],
  'monitor.health_ok': ['正常', 'OK'],
  'monitor.health_degraded': ['降级', 'Degraded'],
  'monitor.health_database': ['数据库', 'Database'],
  'monitor.health_redis': ['Redis', 'Redis'],
  'monitor.health_connected': ['已连接', 'Connected'],
  'monitor.health_disconnected': ['未连接', 'Disconnected'],
  'monitor.no_activity': ['暂无最近活动', 'No recent activity'],
  'monitor.no_health': ['暂无健康数据', 'No health data'],
  'monitor.agents': ['运行中 Agent', 'Active Agents'],
  'monitor.prompts': ['提示词', 'Prompts'],
  'monitor.tools': ['工具', 'Tools'],
  'monitor.mcps': ['MCP 服务', 'MCP Servers'],
  'monitor.skills': ['Skills', 'Skills'],
  'monitor.teams': ['团队', 'Teams'],
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
