import { useState, useEffect } from 'react';
import { Bot, FileText, Wrench, Server, TrendingUp, TrendingDown } from 'lucide-react';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { fetchDashboardStats, type DashboardStats } from '../../../../api/client/admin';
import { MOCK_ACTIVITY, MOCK_HEALTH, type ActivityEntry } from './mock-data';
import { t } from './locales';

const STAT_CONFIG: { key: keyof DashboardStats; icon: typeof Bot; label: string; trend: number }[] = [
  { key: 'agents', icon: Bot, label: 'Active Agents', trend: 12 },
  { key: 'prompts', icon: FileText, label: 'Total Prompts', trend: 8 },
  { key: 'tools', icon: Wrench, label: 'Active Tools', trend: 5 },
  { key: 'mcps', icon: Server, label: 'MCP Servers', trend: -2 },
];

const ACTIVITY_DOT: Record<string, string> = { success: 'var(--da-accent-emerald)', warning: 'var(--da-status-warning)', error: 'var(--da-status-error)' };

function MonitorCenter() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { if (!cancelled) setStats(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <div className="wsta-monitor"><div style={{ padding: 24 }}><CardSkeleton count={4} /></div></div>;

  return (
    <ErrorBoundary fallback={<div className="wsta-monitor wsta-error-state" role="alert"><p>{t('monitor.error_render')}</p></div>}>
    <div className="wsta-monitor">
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {STAT_CONFIG.map((cfg) => (
            <div key={cfg.key} className="wsta-monitor-stat-card" style={{ background: 'var(--da-bg-card)', border: '1px solid var(--da-border-subtle)', borderRadius: 10, padding: 16, cursor: 'default', transition: 'all 0.2s ease', position: 'relative' }}
              onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = 'var(--da-accent)'; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = '0 0 20px rgba(99,102,241,0.15)'; }}
              onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = 'var(--da-border-subtle)'; el.style.transform = ''; el.style.boxShadow = ''; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="wsta-monitor-stat-icon" style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--da-accent)', transition: 'transform 0.2s ease' }}>
                  <cfg.icon size={18} />
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: cfg.trend >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: cfg.trend >= 0 ? '#22c55e' : '#ef4444' }}>
                  {cfg.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {cfg.trend >= 0 ? '+' : ''}{cfg.trend}%
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--da-text-primary)', letterSpacing: '-0.02em' }}>{stats?.[cfg.key] ?? '-'}</div>
              <div style={{ fontSize: 12, color: 'var(--da-text-secondary)', marginTop: 4 }}>{cfg.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1, minHeight: 0 }}>
          <div style={{ background: 'var(--da-bg-card)', border: '1px solid var(--da-border-subtle)', borderRadius: 10, padding: 20, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', marginBottom: 16 }}>Recent Activity</h3>
            {MOCK_ACTIVITY.map((item: ActivityEntry, idx: number) => (
              <div key={item.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: idx < MOCK_ACTIVITY.length - 1 ? '1px solid var(--da-border)' : 'none', alignItems: 'flex-start' }}>
                <span style={{ color: ACTIVITY_DOT[item.type] || 'var(--da-text-muted)', fontSize: 8, lineHeight: '20px', flexShrink: 0 }}>●</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: 'var(--da-text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--da-text-primary)' }}>{item.user}</strong> {item.action} · <em style={{ color: 'var(--da-text-muted)' }}>{item.target}</em>
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--da-text-muted)', marginTop: 2 }}>{item.time}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--da-bg-card)', border: '1px solid var(--da-border-subtle)', borderRadius: 10, padding: 20, overflowY: 'auto' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', marginBottom: 16 }}>System Health</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {MOCK_HEALTH.map((item, idx: number) => (
                <div key={idx}>
                  <div style={{ fontSize: 12, color: 'var(--da-text-secondary)', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--da-text-primary)' }}>{item.value}</div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6 }}>
                    <div style={{ height: '100%', width: '100%', background: item.status === 'normal' ? 'var(--da-accent-emerald)' : 'var(--da-status-warning)', borderRadius: 2, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default MonitorCenter;
