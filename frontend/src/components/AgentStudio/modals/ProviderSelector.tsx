import { useTranslation } from 'react-i18next';
import type { ProvidersMap } from '../../../api/client/providers';

const CAP_LABEL: Record<string, string> = { llm: 'LLM', embedding: 'Embed' };

interface Props {
  providers: ProvidersMap;
  providerType: string;
  usageType: string;
  onChangeProvider: (v: string) => void;
  onChangeUsage: (v: string) => void;
}

export default function ProviderSelector({
  providers, providerType, usageType,
  onChangeProvider, onChangeUsage,
}: Props) {
  const { t } = useTranslation();
  const caps = providers[providerType]?.capabilities ?? ['llm'];
  const multipleCaps = caps.length > 1;

  return (
    <div>
      <div className="flex gap-4">
        <div className="flex-[2]">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.provider')}</label>
          <select
            value={providerType}
            onChange={(e) => onChangeProvider(e.target.value)}
            className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]"
          >
            {Object.entries(providers).map(([key, info]) => (
              <option key={key} value={key}>{info.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-[1]">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('workstation.capabilities')}</label>
          <div className="flex gap-2 mt-1">
            {caps.map((cap) => (
              <span key={cap} className="inline-flex items-center px-[10px] py-0.5 rounded text-xs font-semibold tracking-[0.3px] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
                {CAP_LABEL[cap] || cap}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('workstation.purpose')}</label>
        {multipleCaps ? (
          <div className="flex gap-3">
            {caps.map((cap) => (
              <label key={cap} className="flex items-center gap-2 p-2 px-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md cursor-pointer text-sm text-[var(--color-text-primary)] transition-[border-color] duration-150 hover:border-[var(--color-accent)] [&>input]:[accent-color:var(--color-accent)]">
                <input type="radio" name="usage_type" checked={usageType === cap} onChange={() => onChangeUsage(cap)} />
                <span>{CAP_LABEL[cap] || cap}</span>
              </label>
            ))}
            {caps.includes('llm') && caps.includes('embedding') && (
              <label className="flex items-center gap-2 p-2 px-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md cursor-pointer text-sm text-[var(--color-text-primary)] transition-[border-color] duration-150 hover:border-[var(--color-accent)] [&>input]:[accent-color:var(--color-accent)]">
                <input type="radio" name="usage_type" checked={usageType === 'both'} onChange={() => onChangeUsage('both')} />
                <span>{t('workstation.bothSupported')}</span>
              </label>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 mt-1">
            {caps.map((cap) => (
              <span key={cap} className="inline-flex items-center px-[10px] py-0.5 rounded text-xs font-semibold tracking-[0.3px] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">{CAP_LABEL[cap] || cap}</span>
            ))}
            <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
              {t('workstation.purpose')}: {CAP_LABEL[caps[0]] || caps[0]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
