import { useTranslation } from 'react-i18next';

interface Props {
  usage: {
    today_requests: number;
    today_tokens: number;
    month_requests: number;
    month_tokens: number;
  };
}

export default function ApiUsageTab({ usage }: Props) {
  const { t } = useTranslation();

  return (
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h4>{t('api.usageStats')}</h4>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-lg p-4 text-center">
          <div className="text-[var(--da-font-size-xl)] font-bold text-[var(--da-text-primary)]">{usage.today_requests}</div>
          <div className="text-xs text-[var(--da-text-muted)] mt-1">{t('api.todayRequests')}</div>
        </div>
        <div className="bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-lg p-4 text-center">
          <div className="text-[var(--da-font-size-xl)] font-bold text-[var(--da-text-primary)]">{usage.today_tokens.toLocaleString()}</div>
          <div className="text-xs text-[var(--da-text-muted)] mt-1">{t('api.todayTokens')}</div>
        </div>
        <div className="bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-lg p-4 text-center">
          <div className="text-[var(--da-font-size-xl)] font-bold text-[var(--da-text-primary)]">{usage.month_requests}</div>
          <div className="text-xs text-[var(--da-text-muted)] mt-1">{t('api.monthRequests')}</div>
        </div>
        <div className="bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-lg p-4 text-center">
          <div className="text-[var(--da-font-size-xl)] font-bold text-[var(--da-text-primary)]">{usage.month_tokens.toLocaleString()}</div>
          <div className="text-xs text-[var(--da-text-muted)] mt-1">{t('api.monthTokens')}</div>
        </div>
      </div>
    </div>
  );
}
