import { Bot } from 'lucide-react';
import type { DashboardStats } from '../../../../api/client/admin';

interface StatCard {
  key: keyof DashboardStats;
  icon: typeof Bot;
  label: string;
  tab: string;
}

interface Props {
  stats: DashboardStats | null;
  statCards: StatCard[];
  onNavigate?: (tab: string) => void;
}

export default function MonitorStats({ stats, statCards, onNavigate }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {statCards.map((cfg) => {
        const value = stats?.[cfg.key] ?? '-';
        return (
          <div
            key={cfg.key}
            className="wsta-monitor-stat-card"
            onClick={() => onNavigate?.(cfg.tab)}
            style={{
              background: 'var(--da-bg-card)',
              border: '1px solid var(--da-border-subtle)',
              borderRadius: 10,
              padding: 16,
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              position: 'relative',
              userSelect: 'none',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
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
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--da-text-primary)', letterSpacing: '-0.02em' }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--da-text-secondary)', marginTop: 4 }}>
              {cfg.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
