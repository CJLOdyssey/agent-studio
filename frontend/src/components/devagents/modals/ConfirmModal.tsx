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

export default function ConfirmModal({ title, message, confirmLabel: confirmLabelProp, onConfirm, onCancel, danger }: Props) {
  const { t } = useTranslation();
  const confirmLabel = confirmLabelProp ?? t('confirm.confirm');
  return (
    <Modal title={title} onClose={onCancel} className="confirm-modal"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>{t('confirm.cancel')}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-body">
        {danger ? (
          <OctagonX size={24} className="text-red-500" aria-label={t('confirm.danger')} />
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
