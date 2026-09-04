import { Bot, FileText, Wrench, Server, Zap, Users } from 'lucide-react';
import {
  type DashboardStats,
  type SystemHealth,
  type ActivityEntry as ApiActivity,
} from '../../../../api/client/admin';
import { t } from './locales';
import type { HealthItem } from './MonitorHealth';

export interface ViewActivity {
  id: string;
  time: string;
  action: string;
  target: string;
  type: 'success' | 'warning' | 'info';
  entityType?: string;
  entityId?: string;
}

export interface StatCard {
  key: keyof DashboardStats;
  icon: typeof Bot;
  label: string;
  tab: string;
}

const ACTION_LABELS: Record<string, Record<string, string>> = {
  create: { agent: '创建了 Agent', prompt: '创建了提示词', tool: '创建了工具', mcp: '创建了 MCP', skill: '创建了 Skill', team: '创建了团队', api_key: '创建了 API Key' },
  update: { agent: '更新了 Agent', prompt: '更新了提示词', tool: '更新了工具', mcp: '更新了 MCP', skill: '更新了 Skill', team: '更新了团队' },
  delete: { agent: '删除了 Agent', prompt: '删除了提示词', tool: '删除了工具', mcp: '删除了 MCP', skill: '删除了 Skill', team: '删除了团队', api_key: '删除了 API Key' },
};

function actionLabel(action: string, entityType: string): string {
  return ACTION_LABELS[action]?.[entityType] || `执行了 ${action}_${entityType}`;
}

export function apiToView(a: ApiActivity): ViewActivity {
  return {
    id: a.id,
    time: a.timestamp ? a.timestamp.replace('T', ' ').substring(11, 19) : '',
    action: actionLabel(a.action, a.entity_type),
    target: a.entity_name || `${a.action}_${a.entity_type}`,
    type: 'success',
    entityType: a.entity_type,
    entityId: a.entity_name,
  };
}

export const ICON_MAP: Record<string, typeof Bot> = {
  teams: Users,
  agents: Bot,
  skills: Zap,
  tools: Wrench,
  mcps: Server,
  prompts: FileText,
};

export const TAB_MAP: Record<string, string> = {
  teams: 'teams',
  agents: 'agents',
  skills: 'skills',
  tools: 'tools',
  mcps: 'mcp',
  prompts: 'prompts',
};

export function healthToItems(health: SystemHealth): HealthItem[] {
  const dbOk = health.checks?.database === 'ok';
  const redisOk = health.checks?.redis === 'ok';
  const healthy = health.status === 'healthy';
  const apiOk = health.details?.api_response?.status === 'ok';
  const queueOk = health.details?.queue?.status === 'ok';

  const items: HealthItem[] = [
    {
      label: t('monitor.health_status'),
      value: healthy ? t('monitor.health_ok') : t('monitor.health_degraded'),
      status: healthy ? 'normal' : 'warning',
    },
    {
      label: t('monitor.health_database'),
      value: dbOk ? t('monitor.health_connected') : t('monitor.health_disconnected'),
      status: dbOk ? 'normal' : 'warning',
    },
    {
      label: t('monitor.health_redis'),
      value: redisOk ? t('monitor.health_connected') : t('monitor.health_disconnected'),
      status: redisOk ? 'normal' : 'warning',
    },
  ];

  // 有 API 响应时间则追加展示
  if (health.details?.api_response) {
    const avgMs = health.details.api_response.avg_ms;
    items.push({
      label: 'API 响应时间',
      value: avgMs > 0 ? `${avgMs.toFixed(0)}ms` : '-',
      status: apiOk ? 'normal' : 'warning',
    });
  }

  // 有队列状态则追加展示
  if (health.details?.queue) {
    const queuedJobs = health.details.queue.queued_jobs;
    items.push({
      label: '队列状态',
      value: queueOk ? `${queuedJobs} 任务` : '警告',
      status: queueOk ? 'normal' : 'warning',
    });
  }

  return items;
}

export const AUTO_REFRESH_SECONDS = 60;

export type TabKey = 'overview' | 'cost' | 'performance' | 'traces' | 'alerts';

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '系统概览' },
  { key: 'cost', label: '成本分析' },
  { key: 'performance', label: '性能分析' },
  { key: 'traces', label: '运行轨迹' },
  { key: 'alerts', label: '告警' },
];
