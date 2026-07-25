import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  count: number;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BatchDeleteModal({ count, label = 'Agent', onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('workstation.batchDelete')}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="wsta-confirm-text">
            确定要删除选中的 <strong>{count}</strong> 个 {label} 吗？此操作不可撤销。
          </p>
        </div>
        <div className="modal-footer">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose}>{t('workstation.cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[color-mix(in_srgb,var(--icon-status-error)_15%,transparent)] text-[var(--icon-status-error)] hover:bg-[color-mix(in_srgb,var(--icon-status-error)_25%,transparent)]" onClick={onConfirm}>{t('workstation.confirmDelete')}</button>
        </div>
      </div>
    </div>
  );
}
