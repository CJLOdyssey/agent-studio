import { RefreshCw } from 'lucide-react';

export interface RefreshOption {
  label: string;
  value: number;
}

interface RefreshControlProps {
  /** 上次更新时间（保留接口兼容，但不再显示） */
  lastUpdated?: Date | null;
  /** 自动刷新间隔（毫秒），0 表示关闭 */
  refreshInterval: number;
  /** 可选的刷新间隔选项 */
  options: RefreshOption[];
  /** 是否正在刷新 */
  isRefreshing?: boolean;
  /** 刷新间隔变更回调 */
  onIntervalChange: (interval: number) => void;
  /** 手动刷新回调 */
  onRefresh: () => void;
}

/**
 * 刷新控件组件（大厂风格：简洁）
 *
 * 仅保留：刷新按钮 + 间隔选择器
 */
export function RefreshControl({
  refreshInterval,
  options,
  isRefreshing = false,
  onIntervalChange,
  onRefresh,
}: RefreshControlProps) {
  return (
    <div className="flex items-center border border-[var(--color-border)] rounded-md overflow-hidden">
      {/* 手动刷新按钮 */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center justify-center w-8 h-8 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50 transition-colors"
        title="立即刷新"
        aria-label="立即刷新"
      >
        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
      </button>

      {/* 自动刷新间隔选择器 */}
      <select
        value={refreshInterval}
        onChange={(e) => onIntervalChange(Number(e.target.value))}
        className="h-8 px-2 text-xs border-l border-[var(--color-border)] bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] cursor-pointer hover:bg-[var(--color-surface-elevated)] transition-colors"
        aria-label="自动刷新间隔"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
