import { forwardRef, type ForwardedRef } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OutputConstraintTabProps {
  value: string;
  onChange: (v: string) => void;
  onAddFromWorkstation: () => void;
}

export const OutputConstraintTab = forwardRef(function OutputConstraintTab(
  { value, onChange, onAddFromWorkstation }: OutputConstraintTabProps,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <div className="agent-config-list-bar">
        <button className="agent-config-list-bar-btn" onClick={onAddFromWorkstation}>
          <Plus size={14} />
          {t('workstation.add')}
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('workstation.outputConstraintDesc')}
        className="w-full px-3 py-2 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md text-[var(--da-text-primary)] text-sm resize-y font-[inherit] transition-colors duration-150 focus:border-[var(--da-accent-indigo)] focus:outline-none"
        rows={6}
      />
      <div className="agent-config-char-count">{value.length} {t('workstation.chars')}</div>
      <p className="text-xs text-[var(--da-text-muted)] mt-2">{t('workstation.outputConstraintDesc')}</p>
    </div>
  );
});
