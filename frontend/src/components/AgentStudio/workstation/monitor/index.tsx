import { ErrorBoundary } from '../shared/ErrorBoundary';
import MonitorCenterInner from './MonitorCenter';

export const MonitorCenter = () => (
  <ErrorBoundary>
    <MonitorCenterInner />
  </ErrorBoundary>
);
