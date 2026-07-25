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
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose}>
            {t('confirm.cancel')}
          </button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed" onClick={handleCreate}>
            {t('newProject.confirmCreate')}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--da-text-secondary)', fontSize: '14px', margin: 0 }}>{t('newProject.message')}</p>
    </Modal>
  );
}
