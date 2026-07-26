import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Tag } from 'lucide-react';

interface Props {
  name: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  showKey: boolean;
  onChangeName: (v: string) => void;
  onChangeBaseUrl: (v: string) => void;
  onChangeApiKey: (v: string) => void;
  onChangeIsDefault: (v: boolean) => void;
  onToggleShowKey: () => void;
}

export default function CredentialsSection({
  name, baseUrl, apiKey, isDefault, showKey,
  onChangeName, onChangeBaseUrl, onChangeApiKey,
  onChangeIsDefault, onToggleShowKey,
}: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          {t('providerEdit.name')}
          <span className="font-normal text-[var(--color-text-muted)] text-[11px] ml-1">
            ({t('providerEdit.nameOptional') || 'optional'})
          </span>
        </label>
        <input type="text" value={name} onChange={(e) => onChangeName(e.target.value)}
          placeholder={t('providerEdit.name')}
          className="w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" />
        <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1">
          <Tag size={11} className="shrink-0" /> {t('providerEdit.nameHint')}
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.baseUrl')}</label>
        <input type="text" value={baseUrl} onChange={(e) => onChangeBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.apiKey')}</label>
        <div className="flex items-center bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md overflow-hidden transition-colors focus-within:border-[var(--color-accent)] focus-within:shadow-[0 0 0 2px var(--color-accent)]">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => onChangeApiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 bg-transparent border-none px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:outline-none placeholder:text-[var(--color-text-muted)]" />
          <button type="button" className="p-2 bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center hover:text-[var(--color-text-primary)]"
            onClick={onToggleShowKey} aria-label={showKey ? 'Hide API key' : 'Show API key'}>
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-primary)]">
        <input type="checkbox" checked={isDefault} onChange={(e) => onChangeIsDefault(e.target.checked)}
          className="[accent-color:var(--color-accent)]" />
        <span>设为默认 Key</span>
      </label>
      <p className="text-[11px] text-[var(--color-text-muted)] ml-6 -mt-2 mb-4">当调用未指定 Key 时使用此 Key</p>
    </div>
  );
}
