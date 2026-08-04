import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface Props {
  count: number;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function BatchDeleteModal({ count, label = 'Agent', onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={t('workstation.batchDelete')}
      message={
        <>
          确定要删除选中的 <strong>{count}</strong> 个 {label} 吗？此操作不可撤销。
        </>
      }
      confirmLabel={t('workstation.confirmDelete')}
      cancelLabel={t('workstation.cancel')}
      danger
      onConfirm={onConfirm}
      onCancel={onClose}
      width={420}
    />
  );
}
