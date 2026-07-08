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
        placeholder={t('workstation.outputConstraintDesc')}
        className="form-textarea"
        rows={6}
      />
      <div className="agent-config-char-count">{value.length} {t('workstation.chars')}</div>
      <p className="form-hint">输出约束用于控制 Agent 的回复格式、长度、语言等具体要求</p>
    </div>
  );
});
