import { ErrorBoundary } from '../shared/ErrorBoundary';
import MonitorCenterInner from './MonitorCenter';

export type { StatCard, ActivityEntry, HealthItem } from '@/mocks/monitor';

export const MonitorCenter = () => (
  <ErrorBoundary>
    <MonitorCenterInner />
  </ErrorBoundary>
);
