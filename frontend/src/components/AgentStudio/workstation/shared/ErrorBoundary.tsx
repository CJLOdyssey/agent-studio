import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import i18n from '../../../../i18n';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; onError?: (error: Error) => void; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error);
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const t = i18n.t.bind(i18n);
      return (
        <div className="flex flex-col items-center gap-3 py-16 px-4 text-center" role="alert">
          <AlertTriangle size={40} className="opacity-50 text-[var(--icon-status-error)]" />
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">{t('workstation.renderError')}</div>
          <div className="text-sm text-[var(--color-text-muted)] max-w-80 leading-relaxed">{this.state.error?.message || t('workstation.unknownError')}</div>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-transparent transition-colors duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={this.handleRetry}>
            <RefreshCw size={14} /> {t('common.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
