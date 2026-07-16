import { useState, useEffect, useCallback } from 'react';
import { Bot, FileText, Wrench, Server, Zap, Users, RefreshCw } from 'lucide-react';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  fetchDashboardStats,
  fetchRecentActivity,
  fetchSystemHealth,
  type DashboardStats,
  type SystemHealth,
  type ActivityEntry as ApiActivity,
} from '../../../../api/client/admin';
import { t } from './locales';
import MonitorStats from './MonitorStats';
import MonitorActivity from './MonitorActivity';
import MonitorHealth, { type HealthItem } from './MonitorHealth';

interface ViewActivity {
  id: string;
  time: string;
  action: string;
  target: string;
  type: 'success' | 'warning' | 'info';
}

interface StatCard {
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

function apiToView(a: ApiActivity): ViewActivity {
  return {
    id: a.id,
    time: a.timestamp ? a.timestamp.replace('T', ' ').substring(11, 19) : '',
    action: actionLabel(a.action, a.entity_type),
    target: a.entity_name || `${a.action}_${a.entity_type}`,
    type: 'success',
  };
}

const ICON_MAP: Record<string, typeof Bot> = {
  agents: Bot,
  prompts: FileText,
  tools: Wrench,
  mcps: Server,
  skills: Zap,
  teams: Users,
};

const TAB_MAP: Record<string, string> = {
  agents: 'agents',
  prompts: 'prompts',
  tools: 'tools',
  mcps: 'mcp',
  skills: 'skills',
  teams: 'teams',
};

function healthToItems(health: SystemHealth): HealthItem[] {
  return [
    {
      label: t('monitor.health_status'),
      value: health.status === 'ok' ? t('monitor.health_ok') : t('monitor.health_degraded'),
      status: health.status === 'ok' ? 'normal' : 'warning',
    },
    {
      label: t('monitor.health_database'),
      value: health.database?.startsWith('connected') ? t('monitor.health_connected') : t('monitor.health_disconnected'),
      status: health.database?.startsWith('connected') ? 'normal' : 'warning',
    },
    {
      label: t('monitor.health_redis'),
      value: health.redis?.startsWith('connected') ? t('monitor.health_connected') : t('monitor.health_disconnected'),
      status: health.redis?.startsWith('connected') ? 'normal' : 'warning',
    },
  ];
}

interface Props {
  onNavigate?: (tab: string) => void;
}

function MonitorCenter({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ViewActivity[]>([]);
  const [healthItems, setHealthItems] = useState<HealthItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchDashboardStats(),
      fetchRecentActivity(10),
      fetchSystemHealth(),
    ]).then(([statsResult, activityResult, healthResult]) => {
      if (cancelled) return;
      if (statsResult.status === 'fulfilled') setStats(statsResult.value);
      if (activityResult.status === 'fulfilled') {
        setActivities(activityResult.value.map(apiToView));
      }
      if (healthResult.status === 'fulfilled') {
        setHealthItems(healthToItems(healthResult.value));
      }
      setLastUpdated(new Date().toLocaleTimeString());
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { const c = load(); return c; }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const statCards: StatCard[] = stats
    ? (Object.keys(ICON_MAP) as (keyof DashboardStats)[])
        .filter((k) => k in stats)
        .map((k) => ({
          key: k,
          icon: ICON_MAP[k],
          label: t(`monitor.${k}`) || String(k),
          tab: TAB_MAP[k],
        }))
    : [];

  if (isLoading)
    return (
      <div className="wsta-monitor">
        <div style={{ padding: 24 }}>
          <CardSkeleton count={6} />
        </div>
      </div>
    );

  return (
    <ErrorBoundary
      fallback={
        <div className="wsta-monitor wsta-error-state" role="alert">
          <p>{t('monitor.error_render')}</p>
        </div>
      }
    >
      <div className="wsta-monitor">
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, color: 'var(--da-text-muted)' }}>
              {lastUpdated ? `上次更新: ${lastUpdated}` : ''}
            </div>
            <button
              onClick={load}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 6, border: '1px solid var(--da-border-subtle)',
                background: 'var(--da-bg-card)', color: 'var(--da-text-secondary)',
                cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}
              title={t('monitor.refresh')}
            >
              <RefreshCw size={14} />
              刷新
            </button>
          </div>

          <MonitorStats stats={stats} statCards={statCards} onNavigate={onNavigate} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
            <div style={{ background: 'var(--da-bg-card)', border: '1px solid var(--da-border-subtle)', borderRadius: 10, padding: 20, overflowY: 'auto' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', marginBottom: 16 }}>
                {t('monitor.activity')}
              </h3>
              <MonitorActivity activities={activities} />
            </div>
            <MonitorHealth items={healthItems} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default MonitorCenter;
