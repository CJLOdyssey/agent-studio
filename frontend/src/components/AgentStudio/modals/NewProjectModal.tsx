import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../../shared/Modal';

interface Props {
  onClose: () => void;
  onCreateProject: () => void;
}

export default function NewProjectModal({ onClose, onCreateProject }: Props) {
  const { t } = useTranslation();
  const handleCreate = () => {
    onCreateProject();
    onClose();
  };

  return (
    <Modal
      title={
        <div className="new-project-header">
          <div className="new-project-icon">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3>{t('sidebar.newChat')}</h3>
            <p className="new-project-subtitle">{t('newProject.subtitle')}</p>
          </div>
        </div>
      }
      onClose={onClose}
      className="new-project-modal"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('confirm.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleCreate}>
            {t('newProject.confirmCreate')}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--da-text-secondary)', fontSize: '14px', margin: 0 }}>{t('newProject.message')}</p>
    </Modal>
  );
}
