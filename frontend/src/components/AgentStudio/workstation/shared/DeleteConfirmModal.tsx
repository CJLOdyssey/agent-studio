import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  name: string;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmModal({ name, label = '项目', onConfirm, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--da-bg-secondary)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--da-border-subtle)]">
          <h3>{t('workstation.confirmDelete')}</h3>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col">
          <p className="text-sm text-[var(--da-text-secondary)] leading-relaxed">
            确定要删除 {label} <strong>「{name}」</strong> 吗？此操作不可撤销。
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--da-border-subtle)]">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose}>{t('workstation.cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[color-mix(in_srgb,var(--icon-status-error)_15%,transparent)] text-[var(--icon-status-error)] hover:bg-[color-mix(in_srgb,var(--icon-status-error)_25%,transparent)]" onClick={onConfirm}>{t('workstation.confirmDelete')}</button>
        </div>
      </div>
    </div>
  );
}
