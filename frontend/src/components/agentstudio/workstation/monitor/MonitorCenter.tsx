import { useState, useEffect } from 'react';
import { Bot, FileText, Wrench, Server, TrendingUp, TrendingDown } from 'lucide-react';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  fetchDashboardStats,
  fetchCommandLogs,
  fetchSystemHealth,
  type DashboardStats,
  type SystemHealth,
} from '../../../../api/client/admin';
import { t } from './locales';

interface ActivityEntry {
  id: string;
  time: string;
  user: string;
  action: string;
  target: string;
  type: 'success' | 'warning' | 'info';
}

interface HealthItem {
  label: string;
  value: string;
  status: 'normal' | 'warning';
}

const COMMAND_ACTIONS: Record<string, string> = {
  addAgent: '创建了 Agent',
  updateAgent: '更新了 Agent',
  deleteAgent: '删除了 Agent',
  addPrompt: '创建了提示词',
  updatePrompt: '更新了提示词',
  deletePrompt: '删除了提示词',
  addTool: '创建了工具',
  updateTool: '更新了工具',
  deleteTool: '删除了工具',
  addMCP: '创建了 MCP',
  updateMCP: '更新了 MCP',
  deleteMCP: '删除了 MCP',
  addSkill: '创建了 Skill',
  updateSkill: '更新了 Skill',
  deleteSkill: '删除了 Skill',
  addTeam: '创建了团队',
  updateTeam: '更新了团队',
  deleteTeam: '删除了团队',
  addOutput: '创建了输出约束',
  updateOutput: '更新了输出约束',
  deleteOutput: '删除了输出约束',
};

function commandActionLabel(cmd: string): string {
  return COMMAND_ACTIONS[cmd] || `执行了 ${cmd}`;
}

function extractTarget(payload: string): string {
  try {
    const p = JSON.parse(payload);
    return p.name || p.title || p.command_name || '';
  } catch {
    return '';
  }
}

function logToActivity(log: LogEntry, index: number): ActivityEntry {
  const isError =
    log.result?.toLowerCase().includes('error') ||
    log.result?.toLowerCase().includes('fail');
  return {
    id: log.id || `act-${index}`,
    time: log.timestamp
      ? log.timestamp.replace('T', ' ').substring(11, 19)
      : '',
    user: 'system',
    action: commandActionLabel(log.command),
    target: extractTarget(log.payload) || log.command,
    type: isError ? 'warning' : 'success',
  };
}

function healthToItems(health: SystemHealth): HealthItem[] {
  return [
    {
      label: t('monitor.health_status'),
      value: health.status === 'ok' ? t('monitor.health_ok') : t('monitor.health_degraded'),
      status: health.status === 'ok' ? 'normal' : 'warning',
    },
    {
      label: t('monitor.health_database'),
      value: health.database?.startsWith('connected')
        ? t('monitor.health_connected')
        : t('monitor.health_disconnected'),
      status: health.database?.startsWith('connected') ? 'normal' : 'warning',
    },
    {
      label: t('monitor.health_redis'),
      value: health.redis?.startsWith('connected')
        ? t('monitor.health_connected')
        : t('monitor.health_disconnected'),
      status: health.redis?.startsWith('connected') ? 'normal' : 'warning',
    },
  ];
}

function getStatConfig(): { key: keyof DashboardStats; icon: typeof Bot; label: string; trend: number }[] {
  return [
    { key: 'agents', icon: Bot, label: t('monitor.agents'), trend: 12 },
    { key: 'prompts', icon: FileText, label: t('monitor.prompts'), trend: 8 },
    { key: 'tools', icon: Wrench, label: t('monitor.tools'), trend: 5 },
    { key: 'mcps', icon: Server, label: t('monitor.mcps'), trend: -2 },
  ];
}

const ACTIVITY_DOT: Record<string, string> = {
  success: 'var(--da-accent-emerald)',
  warning: 'var(--da-status-warning)',
  error: 'var(--da-status-error)',
};

function MonitorCenter() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [healthItems, setHealthItems] = useState<HealthItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDashboardStats(),
      fetchCommandLogs(10, 0),
      fetchSystemHealth(),
    ])
      .then(([statsData, logs, health]) => {
        if (cancelled) return;
        setStats(statsData);
        setActivities(logs.map((log, i) => logToActivity(log, i)));
        setHealthItems(healthToItems(health));
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
        setActivities([]);
        setHealthItems([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading)
    return (
      <div className="wsta-monitor">
        <div style={{ padding: 24 }}>
          <CardSkeleton count={4} />
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
          {/* stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {getStatConfig().map((cfg) => (
              <div
                key={cfg.key}
                className="wsta-monitor-stat-card"
                style={{
                  background: 'var(--da-bg-card)',
                  border: '1px solid var(--da-border-subtle)',
                  borderRadius: 10,
                  padding: 16,
                  cursor: 'default',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--da-accent)';
                  el.style.transform = 'translateY(-2px)';
                  el.style.boxShadow = '0 0 20px rgba(99,102,241,0.15)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.borderColor = 'var(--da-border-subtle)';
                  el.style.transform = '';
                  el.style.boxShadow = '';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <div
                    className="wsta-monitor-stat-icon"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'rgba(99,102,241,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--da-accent)',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <cfg.icon size={18} />
                  </div>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        cfg.trend >= 0
                          ? 'rgba(34,197,94,0.15)'
                          : 'rgba(239,68,68,0.15)',
                      color: cfg.trend >= 0 ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {cfg.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {cfg.trend >= 0 ? '+' : ''}
                    {cfg.trend}%
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--da-text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {stats?.[cfg.key] ?? '-'}
                </div>
                <div
                  style={{ fontSize: 12, color: 'var(--da-text-secondary)', marginTop: 4 }}
                >
                  {cfg.label}
                </div>
              </div>
            ))}
          </div>

          {/* activity + health */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 24,
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* activity */}
            <div
              style={{
                background: 'var(--da-bg-card)',
                border: '1px solid var(--da-border-subtle)',
                borderRadius: 10,
                padding: 20,
                overflowY: 'auto',
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--da-text-primary)',
                  marginBottom: 16,
                }}
              >
                {t('monitor.activity')}
              </h3>
              {activities.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--da-text-muted)', textAlign: 'center', padding: 24 }}>
                  {t('monitor.no_activity')}
                </p>
              ) : (
                activities.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '10px 0',
                      borderBottom:
                        idx < activities.length - 1
                          ? '1px solid var(--da-border)'
                          : 'none',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span
                      style={{
                        color: ACTIVITY_DOT[item.type] || 'var(--da-text-muted)',
                        fontSize: 8,
                        lineHeight: '20px',
                        flexShrink: 0,
                      }}
                    >
                      ●
                    </span>
                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--da-text-secondary)',
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ color: 'var(--da-text-primary)' }}>
                          {item.user}
                        </strong>{' '}
                        {item.action}
                        {item.target ? (
                          <>
                            {' · '}
                            <em style={{ color: 'var(--da-text-muted)' }}>
                              {item.target}
                            </em>
                          </>
                        ) : null}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 11,
                          color: 'var(--da-text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {item.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* health */}
            <div
              style={{
                background: 'var(--da-bg-card)',
                border: '1px solid var(--da-border-subtle)',
                borderRadius: 10,
                padding: 20,
                overflowY: 'auto',
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--da-text-primary)',
                  marginBottom: 16,
                }}
              >
                {t('monitor.health')}
              </h3>
              {healthItems.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--da-text-muted)', textAlign: 'center', padding: 24 }}>
                  {t('monitor.no_health')}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {healthItems.map((item, idx) => (
                    <div key={idx}>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--da-text-secondary)',
                          marginBottom: 4,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--da-text-primary)',
                        }}
                      >
                        {item.value}
                      </div>
                      <div
                        style={{
                          height: 4,
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: 2,
                          marginTop: 6,
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: '100%',
                            background:
                              item.status === 'normal'
                                ? 'var(--da-accent-emerald)'
                                : 'var(--da-status-warning)',
                            borderRadius: 2,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default MonitorCenter;
