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
      <p style={{ fontSize: 13, color: 'var(--da-text-muted)', textAlign: 'center', padding: 24 }}>
        {t('monitor.no_activity')}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {activities.map((act) => (
        <div
          key={act.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--da-bg-hover)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: act.type === 'success' ? '#22c55e' : act.type === 'warning' ? '#f59e0b' : '#3b82f6',
              marginTop: 5,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--da-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {act.action}
              </span>
              <span style={{ fontSize: 11, color: 'var(--da-text-muted)', flexShrink: 0 }}>
                {act.time}
              </span>
            </div>
            {act.target && (
              <div style={{ fontSize: 12, color: 'var(--da-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {act.target}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
