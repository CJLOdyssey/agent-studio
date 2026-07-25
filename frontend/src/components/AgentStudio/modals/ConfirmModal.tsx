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
      className="w-[var(--modal-sm)] h-[var(--modal-height)] overflow-hidden"
      footer={
        <>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onCancel}>
            {t('confirm.cancel')}
          </button>
          {danger ? (
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[color-mix(in_srgb,var(--icon-status-error)_15%,transparent)] text-[var(--icon-status-error)] hover:bg-[color-mix(in_srgb,var(--icon-status-error)_25%,transparent)]" onClick={onConfirm}>
              {confirmLabel}
            </button>
          ) : (
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={onConfirm}>
              {confirmLabel}
            </button>
          )}
        </>
      }
    >
      <div className="flex items-start gap-4 p-6">
        {danger ? (
          <OctagonX size={24} className="text-[var(--icon-status-error)]" aria-label={t('confirm.danger')} />
        ) : (
          <AlertTriangle size={24} className="text-[var(--color-accent-soft)]" aria-label={t('confirm.info')} />
        )}
        <div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>{danger ? t('confirm.danger') : t('confirm.info')}</p>
          <p>{message}</p>
        </div>
      </div>
    </Modal>
  );
}
