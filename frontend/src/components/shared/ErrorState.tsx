import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center" role="alert">
      <AlertTriangle size={40} className="text-[var(--color-danger)] mb-4 opacity-60" />
      <p className="text-sm text-[var(--color-text-muted)] mb-4 max-w-sm">
        {message || t('common.errorOccurred')}
      </p>
      {onRetry && (
        <Button icon={<RefreshCw size={14} />} onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
