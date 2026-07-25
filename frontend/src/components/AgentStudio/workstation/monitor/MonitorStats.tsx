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
    <div className="grid grid-cols-3 gap-4">
      {statCards.map((cfg) => {
        const value = stats?.[cfg.key] ?? '-';
        return (
          <div
            key={cfg.key}
            className={`flex items-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg transition-all duration-200 relative select-none hover:border-[var(--color-border-strong)] hover:shadow-[0_1px_6px_rgba(0,0,0,0.06)]${onNavigate ? ' cursor-pointer' : ''}`}
            onClick={() => onNavigate?.(cfg.tab)}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.borderColor = 'var(--color-accent)';
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = '0 0 20px rgba(99,102,241,0.15)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.borderColor = 'var(--color-border)';
              el.style.transform = '';
              el.style.boxShadow = '';
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-accent)]"
                style={{ background: 'rgba(99,102,241,0.08)' }}
              >
                <cfg.icon size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {value}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              {cfg.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
