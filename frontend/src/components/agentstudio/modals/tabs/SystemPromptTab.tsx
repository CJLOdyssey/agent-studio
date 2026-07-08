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
    <div className="form-group">
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
        placeholder={t('workstation.systemPromptDesc')}
        className="form-textarea"
        rows={6}
      />
      <div className="agent-config-char-count">{value.length} {t('workstation.chars')}</div>
      <p className="form-hint">{t('workstation.systemPromptDesc')}</p>
    </div>
  );
});
