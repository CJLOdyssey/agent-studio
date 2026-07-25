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
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className={`bg-[var(--da-bg-secondary)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] wsta-modal${large ? ' wsta-modal-lg' : ''}`}
        role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: width }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--da-border-subtle)]">
          <h3>{title}</h3>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label={t('workstation.close')}>
            <CloseOutlined className="anticon-lg" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col flex flex-col gap-4">
          {errors && errors.length > 0 && (
            <div className="p-3 bg-[var(--icon-status-error)]/10 border border-[var(--icon-status-error)]/30 rounded-md text-[var(--icon-status-error)] text-xs" role="alert">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--da-border-subtle)]">
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
