import { ErrorBoundary } from '../shared/ErrorBoundary';
import LogAuditInner from './LogAudit';

export type { LogEntry } from './mock-data';

export const LogAudit = () => (
  <ErrorBoundary>
    <LogAuditInner />
  </ErrorBoundary>
);
