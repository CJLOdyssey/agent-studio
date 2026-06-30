import { useState, useEffect } from 'react';
import { Activity, Clock, Bot, MessageSquare, Wrench, Server, Zap, Users } from 'lucide-react';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { fetchDashboardStats, type DashboardStats } from '../../../../api/client/admin';
import { MOCK_ACTIVITY, MOCK_HEALTH, type ActivityEntry } from './mock-data';
import { t } from './locales';

const STAT_ICONS = [Bot, MessageSquare, Wrench, Server, Zap, Users] as const;
const STAT_KEYS: (keyof DashboardStats)[] = ['agents', 'prompts', 'tools', 'mcps', 'skills', 'teams'];

function MonitorCenter() {
  const [now, setNow] = useState('');
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
  useEffect(() => {
    function tick() { setNow(new Date().toLocaleString('zh-CN', { hour12: false })); }
    tick(); const timer = setInterval(tick, 30000); return () => clearInterval(timer);
  }, []);

  if (isLoading) return (
    <div className="wsta-monitor" role="region" aria-label={t('monitor.title')}>
      <div className="wsta-monitor-header"><h2 className="wsta-monitor-title"><Activity /><span>{t('monitor.title')}</span></h2></div>
      <CardSkeleton count={6} />
    </div>
  );

  return (
    <ErrorBoundary fallback={<div className="wsta-monitor wsta-error-state" role="alert"><p>{t('monitor.error_render')}</p></div>}>
    <div className="wsta-monitor" role="region" aria-label={t('monitor.title')}>
      <div className="wsta-monitor-header">
        <h2 className="wsta-monitor-title"><Activity /><span>{t('monitor.title')}</span></h2>
        {now && <span className="wsta-monitor-time" aria-live="polite" aria-label={t('monitor.time')}><Clock /><span>{now}</span></span>}
      </div>

      <div className="wsta-monitor-stats" role="list" aria-label={t('monitor.title')}>
        {STAT_KEYS.map((key, i) => {
          const Icon = STAT_ICONS[i];
          return (
            <div key={key} className="wsta-monitor-card" role="listitem">
              <div className="wsta-monitor-card-icon" aria-hidden="true"><Icon /></div>
              <div className="wsta-monitor-card-body">
                <span className="wsta-monitor-card-label">{t(`monitor.${key}`)}</span>
                <span className="wsta-monitor-card-value">{stats?.[key] ?? '-'}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="wsta-monitor-grid">
        <div className="wsta-monitor-section" aria-label={t('monitor.activity')}>
          <h3 className="wsta-monitor-section-title">{t('monitor.activity')}</h3>
          <div className="wsta-monitor-activity-list">
            {MOCK_ACTIVITY.map((item: ActivityEntry) => (
              <div key={item.id} className="wsta-monitor-activity-item">
                <span className={`wsta-monitor-activity-dot wsta-monitor-activity-dot-${item.type}`} />
                <div className="wsta-monitor-activity-content">
                  <span className="wsta-monitor-activity-text"><strong>{item.user}</strong> {item.action} · <em>{item.target}</em></span>
                  <span className="wsta-monitor-activity-time">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="wsta-monitor-section" aria-label={t('monitor.health')}>
          <h3 className="wsta-monitor-section-title">{t('monitor.health')}</h3>
          <div className="wsta-monitor-health-list">
            {MOCK_HEALTH.map((item, idx) => (
              <div key={idx} className="wsta-monitor-health-item">
                <span className={`wsta-monitor-health-dot ${item.status === 'warning' ? 'wsta-monitor-health-dot-warning' : 'wsta-monitor-health-dot-normal'}`} />
                <span className="wsta-monitor-health-label">{item.label}</span>
                <span className={`wsta-monitor-health-value ${item.status === 'warning' ? 'wsta-monitor-health-value-warning' : ''}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default MonitorCenter;
