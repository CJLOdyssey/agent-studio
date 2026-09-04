import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { CardSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import {
  fetchDashboardStats,
  fetchRecentActivity,
  fetchSystemHealth,
  type DashboardStats,
  type SystemHealth,
} from '../../../../api/client/admin';
import { t } from './locales';
import MonitorStats from './MonitorStats';
import MonitorActivity from './MonitorActivity';
import MonitorHealth, { type HealthItem } from './MonitorHealth';
import { CostAnalysis } from './CostAnalysis';
import { PerformanceAnalysis } from './PerformanceAnalysis';
import { AlertRules } from './AlertRules';
import { AlertEvents } from './AlertEvents';
import { AlertSubscriptions } from './AlertSubscriptions';
import LLMTraces from './LLMTraces';
import { SloBudget } from './SloBudget';
import {
  type ViewActivity,
  type StatCard,
  ICON_MAP,
  TAB_MAP,
  TABS,
  AUTO_REFRESH_SECONDS,
  type TabKey,
  apiToView,
  healthToItems,
} from './monitorCenterData';

interface Props {
  onNavigate?: (tab: string) => void;
}

function MonitorCenter({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<ViewActivity[]>([]);
  const [healthItems, setHealthItems] = useState<HealthItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(AUTO_REFRESH_SECONDS);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

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

  // 每 60 秒自动刷新；同时维护一个每秒递减的倒计时，让用户知道
  // 下一次自动刷新在什么时候（避免只看到被动的“上次更新”）。
  useEffect(() => {
    const timer = setInterval(load, AUTO_REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 新数据刷新时重置倒计时
    setNextRefreshIn(AUTO_REFRESH_SECONDS);
    const tick = setInterval(() => {
      setNextRefreshIn((s) => (s <= 1 ? AUTO_REFRESH_SECONDS : s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

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

  // resetKeys 一旦变化（如后端恢复新一轮数据成功 / 网络恢复），ErrorBoundary
  // 自动清错回正，无需用户手动刷新。这是修复「后端 systemd 重启 1 秒 → 整页
  // 卡在「模块出错了」」的关键。同时保留自定义轻量 fallback，避免破坏 6 tab 平铺
  // 的视觉布局（fallback 显示在内容区，而非整页刷屏）。
  const resetKeys = [lastUpdated, health?.status ?? '', nextRefreshIn > 0 ? 'online' : 'stale'];

  return (
    <ErrorBoundary resetKeys={resetKeys}>
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 p-6 gap-6 overflow-y-auto">
          {/* 标签页切换：大厂监控页常见范式 —— 顶部导航式 tab，激活项带
              accent 底 + 白字，未激活为透明 + 底部描边，hover 才浮现底色。 */}
          <div className="flex items-center justify-between">
            <nav aria-label="监控分区" className="flex items-center">
              {TABS.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      active
                        ? 'bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="flex items-center gap-4">
              <div className="text-right text-xs text-[var(--color-text-muted)] leading-4 tabular-nums">
                {lastUpdated ? <div>上次更新 {lastUpdated}</div> : null}
                <div className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-success)]"
                    aria-hidden="true"
                  />
                  {nextRefreshIn} 秒后自动刷新
                </div>
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
            <CostAnalysis />
          )}

          {/* 性能分析标签页 */}
          {activeTab === 'performance' && (
            <PerformanceAnalysis />
          )}

          {/* 运行轨迹标签页（LLM Trace 浏览器：列表 ⇄ 详情瀑布） */}
          {activeTab === 'traces' && <LLMTraces />}

          {/* 告警标签页 */}
          {activeTab === 'alerts' && (
            <div className="flex flex-col gap-6">
              <AlertRules />
              <AlertEvents />
              <AlertSubscriptions />
              <SloBudget />
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default MonitorCenter;
