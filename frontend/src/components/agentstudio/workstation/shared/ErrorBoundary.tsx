import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
      return (
        <div className="wsta-error-state" role="alert">
          <AlertTriangle size={40} className="wsta-error-state-icon" />
          <div className="wsta-error-state-title">组件渲染出错</div>
          <div className="wsta-error-state-desc">{this.state.error?.message || '发生未知错误'}</div>
          <button className="btn btn-outline" onClick={this.handleRetry}>
            <RefreshCw size={14} /> 重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
