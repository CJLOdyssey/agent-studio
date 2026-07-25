import { t } from './locales';

interface ViewActivity {
  id: string;
  time: string;
  action: string;
  target: string;
  type: 'success' | 'warning' | 'info';
}

interface Props {
  activities: ViewActivity[];
}

export default function MonitorActivity({ activities }: Props) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] text-center p-6">
        {t('monitor.no_activity')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {activities.map((act) => (
        <div
          key={act.id}
          className="flex items-start gap-2.5 py-2 px-2.5 rounded-lg bg-[var(--color-surface-hover)]"
        >
          <span
            className="w-2 h-2 rounded-full shrink-0 mt-[5px]"
            style={{ background: act.type === 'success' ? '#22c55e' : act.type === 'warning' ? '#f59e0b' : '#3b82f6' }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {act.action}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {act.time}
              </span>
            </div>
            {act.target && (
              <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                {act.target}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
