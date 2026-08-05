import { forwardRef, type ForwardedRef } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SystemPromptTabProps {
  value: string;
  onChange: (v: string) => void;
  onAddFromWorkstation: () => void;
}

export const SystemPromptTab = forwardRef(function SystemPromptTab(
  { value, onChange, onAddFromWorkstation }: SystemPromptTabProps,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-3 gap-2 shrink-0">
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--color-border)] rounded-md bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] text-xs cursor-pointer transition-[background,border-color,color] duration-150 ease hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] [&>svg]:opacity-60 hover:[&>svg]:opacity-100" onClick={onAddFromWorkstation}>
          <Plus size={14} />
          {t('workstation.add')}
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('workstation.systemPromptDesc')}
        className="flex-1 min-h-0 w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm resize-y font-[inherit] transition-colors duration-150 focus:border-[var(--color-accent)] focus:outline-none"
      />
      <div className="text-xs text-[var(--color-text-muted)] text-right mt-1 opacity-60 shrink-0">{value.length} {t('workstation.chars')}</div>
    </div>
  );
});
