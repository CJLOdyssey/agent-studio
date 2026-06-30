import { ErrorBoundary } from '../shared/ErrorBoundary';
import SystemSettingsInner from './SystemSettings';

export type { SettingSection, SettingField } from './mock-data';

export const SystemSettings = () => (
  <ErrorBoundary>
    <SystemSettingsInner />
  </ErrorBoundary>
);
