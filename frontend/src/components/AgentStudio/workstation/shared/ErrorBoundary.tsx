import { Component } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import i18n from '../../../../i18n';
import type * as React from 'react';

interface Props {
  children: React.ReactNode;
  /** 自定义 fallback —— 传入时优先展示，否则使用默认（带错误详情 + 重试）。 */
  fallback?: React.ReactNode;
  /** 触发 reset 时调用（一般无需传） */
  onError?: (error: Error) => void;
  /**
   * 自动复位键：任一项变化都会强制 reset 错误状态。
   * 典型场景：把"上次成功刷新时间"或"网络是否在线"放进来，
   * 外部条件变化时整页自动恢复，无需用户刷新。
   */
  resetKeys?: ReadonlyArray<unknown>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** 上一次记录的 resetKeys，用于比较是否真发生了变化（避免无限清错循环）。 */
  prevResetKeys: ReadonlyArray<unknown>;
}

function shallowArrayEqual(
  a: ReadonlyArray<unknown>,
  b: ReadonlyArray<unknown>,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 大厂 ErrorBoundary 三件套：
 *   1) fallback 显示真实错误（不再静默"模块出错了"），便于排查
 *   2) 提供"重试"按钮（清空状态 + 触发 remount）
 *   3) resetKeys：父级传一个"健康信号"进来，条件变化时自动 reset，
 *      让"后端暂时不可达 → EB 触发 → 后端恢复 → 整页自动恢复"无需用户手动刷新
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    prevResetKeys: this.props.resetKeys ?? [],
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): Partial<State> | null {
    const nextKeys = nextProps.resetKeys ?? [];
    if (shallowArrayEqual(prevState.prevResetKeys, nextKeys)) return null;
    // resetKeys 真发生了变化：
    //  - 当前有错 → 清错
    //  - 当前无错 → 仅更新 prevResetKeys
    const update: Partial<State> = { prevResetKeys: nextKeys };
    if (prevState.hasError) {
      update.hasError = false;
      update.error = null;
    }
    return update;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error);
    // 上抛到全局，便于接入 Sentry / 控制台观察
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const t = i18n.t.bind(i18n);
      const errMsg = this.state.error?.message || t('workstation.unknownError');
      const isNetwork = /network|fetch|connect|timeout|econn|proxy_502/i.test(errMsg);
      return (
        <div
          className="flex flex-col items-center gap-3 py-16 px-4 text-center"
          role="alert"
        >
          {isNetwork ? (
            <WifiOff size={42} className="opacity-70 text-[var(--color-warning)]" />
          ) : (
            <AlertTriangle size={40} className="opacity-50 text-[var(--color-danger)]" />
          )}
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {isNetwork ? '服务暂时不可达' : t('workstation.renderError')}
          </div>
          <div className="text-sm text-[var(--color-text-muted)] max-w-md leading-relaxed">
            {isNetwork
              ? '后端服务短暂不可达（可能正在重启），稍候会自动恢复。'
              : errMsg}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Wifi size={12} className="opacity-60" />
            <span className="font-mono">{errMsg.slice(0, 120)}</span>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-transparent transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
            onClick={this.handleRetry}
          >
            <RefreshCw size={14} /> {t('common.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
