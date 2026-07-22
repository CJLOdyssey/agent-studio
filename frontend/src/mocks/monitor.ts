import { Bot, MessageSquare, Wrench, Server, Zap, Users } from 'lucide-react';

export interface StatCard { key: string; icon: typeof Bot; label: string; value: number; delta: number; unit: string; }

export interface ActivityEntry { id: string; time: string; user: string; action: string; target: string; type: 'success' | 'warning' | 'info'; }

export interface HealthItem { label: string; value: string; status: 'normal' | 'warning'; }

export const MOCK_STATS: StatCard[] = [
  { key: 'agents', icon: Bot, label: '运行中 Agent', value: 7, delta: 2, unit: '' },
  { key: 'prompts', icon: MessageSquare, label: '活跃提示词', value: 12, delta: 1, unit: '' },
  { key: 'tools', icon: Wrench, label: '已启用工具', value: 8, delta: 0, unit: '' },
  { key: 'mcps', icon: Server, label: '已连接 MCP', value: 6, delta: -1, unit: '' },
  { key: 'skills', icon: Zap, label: '已安装 Skills', value: 7, delta: 1, unit: '' },
  { key: 'teams', icon: Users, label: '活跃团队', value: 7, delta: 0, unit: '' },
];

export const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: '1', time: '09:32:15', user: 'admin', action: '创建了 Agent', target: '前端开发 Agent', type: 'success' },
  { id: '2', time: '09:28:40', user: 'dev', action: '更新了提示词', target: '代码审查助手 v3.2.0', type: 'info' },
  { id: '3', time: '09:15:02', user: 'admin', action: '启用了工具', target: 'GitHub API 工具', type: 'success' },
  { id: '4', time: '08:55:30', user: 'ops', action: 'MCP 连接断开', target: 'Redis MCP', type: 'warning' },
  { id: '5', time: '08:42:18', user: 'dev', action: '安装了 Skill', target: 'TypeScript 类型系统', type: 'success' },
  { id: '6', time: '08:30:00', user: 'system', action: '自动备份完成', target: '系统配置备份', type: 'info' },
  { id: '7', time: '08:12:45', user: 'admin', action: '创建了团队', target: '技术写作团队', type: 'success' },
  { id: '8', time: '07:55:20', user: 'ops', action: 'Agent 状态异常', target: '架构师 Agent', type: 'warning' },
  { id: '9', time: '07:30:10', user: 'system', action: '日常健康检查', target: '所有服务正常', type: 'info' },
];

export const MOCK_HEALTH: HealthItem[] = [
  { label: '系统响应时间', value: '142ms', status: 'normal' },
  { label: 'API 成功率', value: '99.8%', status: 'normal' },
  { label: '内存使用率', value: '67%', status: 'normal' },
  { label: '磁盘使用率', value: '82%', status: 'warning' },
  { label: '队列积压', value: '23 项', status: 'normal' },
];
