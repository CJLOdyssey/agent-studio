import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../../../shared/ConfirmDialog';

interface Props {
  name: string;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmModal({ name, label = '项目', onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={t('workstation.confirmDelete')}
      message={
        <>
          确定要删除 {label} <strong>「{name}」</strong> 吗？此操作不可撤销。
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
