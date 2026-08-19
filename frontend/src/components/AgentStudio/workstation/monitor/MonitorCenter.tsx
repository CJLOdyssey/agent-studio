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
import { CostDashboard } from './CostDashboard';
import { PerformanceAnalysis } from './PerformanceAnalysis';
import { AlertRules } from './AlertRules';
import { AlertEvents } from './AlertEvents';
import { AlertSubscriptions } from './AlertSubscriptions';
import { RunTraces } from './RunTraces';
import { TraceDetail } from './TraceDetail';
import { SloBudget } from './SloBudget';
import { useTeamData } from '../../../../hooks/useTeamData';

interface ViewActivity {
  id: string;
  time: string;
  action: string;
  target: string;
  type: 'success' | 'warning' | 'info';
  entityType?: string;
  entityId?: string;
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
    entityType: a.entity_type,
    entityId: a.entity_name,
  };
}

const ICON_MAP: Record<string, typeof Bot> = {
  teams: Users,
  agents: Bot,
  skills: Zap,
  tools: Wrench,
  mcps: Server,
  prompts: FileText,
};

const TAB_MAP: Record<string, string> = {
  teams: 'teams',
  agents: 'agents',
  skills: 'skills',
  tools: 'tools',
  mcps: 'mcp',
  prompts: 'prompts',
};

function healthToItems(health: SystemHealth): HealthItem[] {
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

  // Add API response time if available
  if (health.details?.api_response) {
    const avgMs = health.details.api_response.avg_ms;
    items.push({
      label: 'API 响应时间',
      value: avgMs > 0 ? `${avgMs.toFixed(0)}ms` : '-',
      status: apiOk ? 'normal' : 'warning',
    });
  }

  // Add queue status if available
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

interface Props {
  onNavigate?: (tab: string) => void;
}

function MonitorCenter({ onNavigate }: Props) {
  const { teams } = useTeamData();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ViewActivity[]>([]);
  const [healthItems, setHealthItems] = useState<HealthItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'cost' | 'performance' | 'traces' | 'alerts' | 'slo'>('overview');
  const [activeTrace, setActiveTrace] = useState<string | null>(null);

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
        setHealth(healthResult.value);
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
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <div className="p-6">
          <CardSkeleton count={6} />
        </div>
      </div>
    );

  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert">
          <p>{t('monitor.error_render')}</p>
        </div>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 p-6 gap-6 overflow-y-auto">
          {/* 标签页切换 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                系统概览
              </button>
              <button
                onClick={() => setActiveTab('cost')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'cost'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                成本分析
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'performance'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                性能分析
              </button>
              <button
                onClick={() => setActiveTab('traces')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'traces'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                运行轨迹
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'alerts'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                告警
              </button>
              <button
                onClick={() => setActiveTab('slo')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'slo'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)]'
                }`}
              >
                SLO
              </button>
            </div>
            <div className="flex items-center gap-4">
              {teams.length > 0 && (
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)]"
                >
                  <option value="">全部团队</option>
                  {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              )}
              <div className="text-sm text-[var(--color-text-muted)]">
                {lastUpdated ? `上次更新: ${lastUpdated}` : ''}
              </div>
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] cursor-pointer text-xs font-medium"
                title={t('monitor.refresh')}
              >
                <RefreshCw size={14} />
                刷新
              </button>
            </div>
          </div>

          {/* 系统概览标签页 */}
          {activeTab === 'overview' && (
            <>
              <MonitorStats stats={stats} statCards={statCards} health={health} onNavigate={onNavigate} />

              <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-5 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                    {t('monitor.activity')}
                  </h3>
                  <MonitorActivity activities={activities} onNavigate={onNavigate} />
                </div>
                <MonitorHealth items={healthItems} />
              </div>
            </>
          )}

          {/* 成本分析标签页 */}
          {activeTab === 'cost' && (
            <CostDashboard teamId={selectedTeam || undefined} />
          )}

          {/* 性能分析标签页 */}
          {activeTab === 'performance' && (
            <PerformanceAnalysis teamId={selectedTeam || undefined} />
          )}

          {/* 运行轨迹标签页 */}
          {activeTab === 'traces' && (
            activeTrace
              ? <TraceDetail traceId={activeTrace} onBack={() => setActiveTrace(null)} />
              : <RunTraces onSelectTrace={setActiveTrace} />
          )}

          {/* 告警标签页 */}
          {activeTab === 'alerts' && (
            <div className="flex flex-col gap-6">
              <AlertRules />
              <AlertEvents />
              <AlertSubscriptions />
            </div>
          )}

          {/* SLO 标签页 */}
          {activeTab === 'slo' && (
            <SloBudget />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default MonitorCenter;
