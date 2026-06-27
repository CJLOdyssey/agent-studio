import { ErrorBoundary } from '../shared/ErrorBoundary';
import MonitorCenterInner from './MonitorCenter';

export type { StatCard, ActivityEntry, HealthItem } from './mock-data';

export const MonitorCenter = () => (
  <ErrorBoundary>
    <MonitorCenterInner />
  </ErrorBoundary>
);
