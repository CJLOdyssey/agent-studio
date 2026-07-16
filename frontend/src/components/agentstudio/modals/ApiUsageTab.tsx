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
    <div className="api-usage-tab">
      <div className="api-section-header">
        <h4>{t('api.usageStats')}</h4>
      </div>
      <div className="api-usage-cards">
        <div className="api-usage-card">
          <div className="api-usage-value">{usage.today_requests}</div>
          <div className="api-usage-label">{t('api.todayRequests')}</div>
        </div>
        <div className="api-usage-card">
          <div className="api-usage-value">{usage.today_tokens.toLocaleString()}</div>
          <div className="api-usage-label">{t('api.todayTokens')}</div>
        </div>
        <div className="api-usage-card">
          <div className="api-usage-value">{usage.month_requests}</div>
          <div className="api-usage-label">{t('api.monthRequests')}</div>
        </div>
        <div className="api-usage-card">
          <div className="api-usage-value">{usage.month_tokens.toLocaleString()}</div>
          <div className="api-usage-label">{t('api.monthTokens')}</div>
        </div>
      </div>
    </div>
  );
}
