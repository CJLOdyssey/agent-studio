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
    <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
        {t('monitor.health')}
      </h3>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-center px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)]"
          >
            <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
            <span
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: item.status === 'normal' ? 'var(--color-success)' : 'var(--color-warning)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: item.status === 'normal' ? 'var(--color-success)' : 'var(--color-warning)' }}
              />{item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
