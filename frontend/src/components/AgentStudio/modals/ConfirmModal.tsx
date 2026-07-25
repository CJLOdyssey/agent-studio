import { AlertTriangle, OctagonX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../../shared/Modal';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel: confirmLabelProp,
  onConfirm,
  onCancel,
  danger,
}: Props) {
  const { t } = useTranslation();
  const confirmLabel = confirmLabelProp ?? t('confirm.confirm');
  return (
    <Modal
      title={title}
      onClose={onCancel}
      className="confirm-modal"
      footer={
        <>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onCancel}>
            {t('confirm.cancel')}
          </button>
          {danger ? (
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[color-mix(in_srgb,var(--icon-status-error)_15%,transparent)] text-[var(--icon-status-error)] hover:bg-[color-mix(in_srgb,var(--icon-status-error)_25%,transparent)]" onClick={onConfirm}>
              {confirmLabel}
            </button>
          ) : (
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed" onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
        </>
      }
    >
      <div className="confirm-body">
        {danger ? (
          <OctagonX size={24} className="text-[var(--icon-status-error)]" aria-label={t('confirm.danger')} />
        ) : (
          <AlertTriangle size={24} className="text-[var(--da-accent-amber)]" aria-label={t('confirm.info')} />
        )}
        <div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{danger ? t('confirm.danger') : t('confirm.info')}</p>
          <p>{message}</p>
        </div>
      </div>
    </Modal>
  );
}
