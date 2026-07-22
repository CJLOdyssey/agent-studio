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
        <div className="wsta-error-state" role="alert">
          <AlertTriangle size={40} className="wsta-error-state-icon" />
          <div className="wsta-error-state-title">{t('workstation.renderError')}</div>
          <div className="wsta-error-state-desc">{this.state.error?.message || t('workstation.unknownError')}</div>
          <button className="btn btn-outline" onClick={this.handleRetry}>
            <RefreshCw size={14} /> {t('common.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
