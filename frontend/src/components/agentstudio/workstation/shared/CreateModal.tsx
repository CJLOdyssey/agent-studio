import type { ReactNode, KeyboardEvent } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';

interface CreateModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  errors?: string[];
  isEdit?: boolean;
  onDelete?: () => void;
  width?: number;
  large?: boolean;
}

export default function CreateModal({
  title, children, onClose, onSave, saveLabel, errors, isEdit, onDelete, width = 560, large,
}: CreateModalProps) {
  const { t } = useTranslation();
  const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className={`modal-content wsta-modal${large ? ' wsta-modal-lg' : ''}`}
        role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: width }}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('workstation.close')}>
            <CloseOutlined className="anticon-lg" />
          </button>
        </div>

        <div className="modal-body wsta-modal-body">
          {errors && errors.length > 0 && (
            <div className="wsta-form-errors" role="alert">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          {children}
        </div>

        <div className="modal-footer">
          {isEdit && onDelete && (
            <Button danger onClick={onDelete}>{t('workstation.delete')}</Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={onClose}>{t('workstation.cancel')}</Button>
            <Button type="primary" onClick={onSave}>{saveLabel || t('workstation.save')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
