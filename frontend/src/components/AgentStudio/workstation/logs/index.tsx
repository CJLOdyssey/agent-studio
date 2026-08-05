import { ErrorBoundary } from '../shared/ErrorBoundary';
import LogAuditInner from './LogAudit';

export const LogAudit = () => (
  <ErrorBoundary>
    <LogAuditInner />
  </ErrorBoundary>
);
