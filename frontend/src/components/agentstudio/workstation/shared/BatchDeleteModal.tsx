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
      <div className="modal-content wsta-modal wsta-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('workstation.batchDelete')}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="wsta-confirm-text">
            确定要删除选中的 <strong>{count}</strong> 个 {label} 吗？此操作不可撤销。
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('workstation.cancel')}</button>
          <button className="btn btn-danger" onClick={onConfirm}>{t('workstation.confirmDelete')}</button>
        </div>
      </div>
    </div>
  );
}
