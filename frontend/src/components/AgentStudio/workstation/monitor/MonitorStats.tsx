import { Bot, Activity, MemoryStick } from 'lucide-react';
import type { DashboardStats, SystemHealth } from '../../../../api/client/admin';

interface StatCard {
  key: keyof DashboardStats;
  icon: typeof Bot;
  label: string;
  tab: string;
}

interface Props {
  stats: DashboardStats | null;
  statCards: StatCard[];
  health?: SystemHealth | null;
  onNavigate?: (tab: string) => void;
}

export default function MonitorStats({ stats, statCards, health, onNavigate }: Props) {
  const qps = health?.details?.qps ?? 0;
  const memMb = health?.details?.mem_usage_mb;

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((cfg) => {
          const value = stats?.[cfg.key] ?? '';
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

      {/* 黄金信号补全：流量(QPS) + 饱和度(内存) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg">
          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-accent)]" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <Activity size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {qps.toFixed(1)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">请求/秒 (QPS)</div>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg">
          <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-accent)]" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <MemoryStick size={18} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {memMb != null ? `${memMb.toFixed(0)}MB` : 'N/A'}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">内存 (RSS)</div>
          </div>
        </div>
      </div>
    </>
  );
}
