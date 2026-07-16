import { t } from './locales';

export interface HealthItem {
  label: string;
  value: string;
  status: 'normal' | 'warning';
}

interface Props {
  items: HealthItem[];
}

export default function MonitorHealth({ items }: Props) {
  return (
    <div
      style={{
        background: 'var(--da-bg-card)',
        border: '1px solid var(--da-border-subtle)',
        borderRadius: 10,
        padding: 20,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--da-text-primary)', marginBottom: 16 }}>
        {t('monitor.health')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--da-bg-hover)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--da-text-secondary)' }}>{item.label}</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: item.status === 'normal' ? '#22c55e' : '#f59e0b',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: item.status === 'normal' ? '#22c55e' : '#f59e0b',
                }}
              />
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
