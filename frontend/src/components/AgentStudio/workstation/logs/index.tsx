import { ErrorBoundary } from '../shared/ErrorBoundary';
import LogAuditInner from './LogAudit';

export type { LogEntry } from '@/mocks/logs';

export const LogAudit = () => (
  <ErrorBoundary>
    <LogAuditInner />
  </ErrorBoundary>
);
