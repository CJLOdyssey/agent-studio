import { X, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  kindName: string;  // e.g. "工具", "MCP", "Skill"
  name: string;
  onArchive: () => void;
  onCancel: () => void;
}

export default function ArchiveConfirmModal({ kindName, name, onArchive, onCancel }: Props) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onCancel}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-w-[400px] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Archive size={16} />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('workstation.archiveConfirmTitle')}</h3>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-5 pb-5">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {t('workstation.archiveConfirmDesc', { tool: kindName, name })}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onCancel}>{t('workstation.cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90" onClick={onArchive}>
            <Archive size={14} />
            {t('workstation.archiveBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
