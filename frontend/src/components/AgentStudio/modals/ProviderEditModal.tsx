import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Eye, EyeOff, Save, Loader2, RefreshCw, Tag } from 'lucide-react';

import { fetchModelsFromProvider } from '../../../api/client/keys';
import { listProviders } from '../../../api/client/providers';
import type { ProvidersMap } from '../../../api/client/providers';

export interface ApiProviderForm {
  id: string;
  provider: string;
  usage_type: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isActive: boolean;
  status?: 'connected' | 'error' | 'untested';
}

/** Fallback used when /api/providers is unreachable. */
const FALLBACK_PROVIDERS: ProvidersMap = {
  openai:    { name: 'OpenAI',       base_url: 'https://api.openai.com/v1',                          capabilities: ['llm', 'embedding'], docs_url: null },
  deepseek:  { name: 'DeepSeek',     base_url: 'https://api.deepseek.com',                           capabilities: ['llm'],              docs_url: null },
  anthropic: { name: 'Anthropic',    base_url: 'https://api.anthropic.com',                          capabilities: ['llm'],              docs_url: null },
  dashscope: { name: 'DashScope',    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',  capabilities: ['llm', 'embedding'], docs_url: null },
  custom:    { name: '自定义',       base_url: '',                                                    capabilities: ['llm', 'embedding'], docs_url: null },
};

interface Props {
  provider: ApiProviderForm;
  onSave: (provider: ApiProviderForm) => void;
  onClose: () => void;
  saving?: boolean;
}

const CAP_LABEL: Record<string, string> = { llm: 'LLM', embedding: 'Embed' };

export default function ProviderEditModal({ provider, onSave, onClose, saving = false }: Props) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  const [providers, setProviders] = useState<ProvidersMap>(FALLBACK_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const [providerType, setProviderType] = useState(provider.provider || 'custom');
  const [usageType, setUsageType] = useState(provider.usage_type || 'llm');
  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [models, setModels] = useState<string[]>(provider.models);
  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  useEffect(() => {
    listProviders()
      .then(setProviders)
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, []);

  useEffect(() => {
    const info = providers[providerType];
    if (!info || !info.base_url) return;
    const knownDefaults = Object.values(providers).map((p) => p.base_url).filter(Boolean);
    const nextBaseUrl = (!baseUrl || knownDefaults.includes(baseUrl)) ? info.base_url : baseUrl;
    let nextUsage = usageType;
    if (usageType === 'both' && !info.capabilities.includes('embedding')) nextUsage = 'llm';
    if (usageType === 'embedding' && !info.capabilities.includes('embedding')) nextUsage = 'llm';
    const patch: Record<string, string> = {};
    if (nextBaseUrl !== baseUrl) patch.baseUrl = nextBaseUrl;
    if (nextUsage !== usageType) patch.usageType = nextUsage;
    if (Object.keys(patch).length) requestAnimationFrame(() => {
      if (patch.baseUrl) setBaseUrl(patch.baseUrl);
      if (patch.usageType) setUsageType(patch.usageType as 'llm' | 'embedding' | 'both');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerType]);

  const caps = providers[providerType]?.capabilities ?? ['llm'];
  const multipleCaps = caps.length > 1;
  const showModels = usageType === 'llm' || usageType === 'both';

  const handleSave = () => {
    onSave({
      ...provider, provider: providerType, usage_type: usageType,
      name, baseUrl, apiKey, models,
    });
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setFetchingModels(true);
    try {
      const result = await fetchModelsFromProvider({
        api_key: apiKey, base_url: baseUrl || undefined, provider: providerType,
      });
      if (result.success && result.models.length > 0) setModels(result.models);
      else setModels([]);
    } catch { setModels([]); }
    finally { setFetchingModels(false); }
  };

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--da-bg-secondary)] rounded-xl w-[420px] max-h-[480px] max-w-[560px] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" onClick={(e) => e.stopPropagation()} ref={contentRef} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--da-border-subtle)]">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[color-mix(in_srgb,var(--da-bg-primary),var(--da-text-primary)_8%)] flex items-center justify-center text-[var(--da-accent-indigo)] shrink-0">
              {loadingProviders ? <Loader2 size={16} className="animate-spin" /> : <Tag size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{provider.id ? t('providerEdit.edit') : t('providerEdit.add')}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)' }}>
                {providers[providerType]?.base_url || ''}
              </p>
            </div>
          </div>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>

        <div className="flex-1 px-6 py-5 overflow-y-auto">
          <div className="flex gap-4">
            <div className="mb-4" style={{ flex: 2 }}>
              <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">{t('providerEdit.provider')}</label>
              <select value={providerType} onChange={(e) => setProviderType(e.target.value)}>
                {Object.entries(providers).map(([key, info]) => (
                  <option key={key} value={key}>{info.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-4" style={{ flex: 1 }}>
              <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">{t('workstation.capabilities')}</label>
              <div className="flex gap-2" style={{ marginTop: 4 }}>
                {caps.map((cap) => (
                  <span key={cap} className={`inline-flex items-center px-[10px] py-0.5 rounded text-xs font-semibold tracking-[0.3px] bg-[color-mix(in_srgb,var(--da-accent-${cap === 'llm' ? 'indigo' : 'emerald'})_15%,transparent)] text-[var(--da-accent-${cap === 'llm' ? 'indigo' : 'emerald'})] border border-[color-mix(in_srgb,var(--da-accent-${cap === 'llm' ? 'indigo' : 'emerald'})_30%,transparent)]`}>{CAP_LABEL[cap] || cap}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">{t('workstation.purpose')}</label>
            {multipleCaps ? (
              <div className="flex gap-3">
                {caps.map((cap) => (
                  <label key={cap} className="flex items-center gap-2 p-2 px-3 bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-md cursor-pointer text-sm text-[var(--da-text-primary)] transition-[border-color] duration-150 hover:border-[var(--da-accent-indigo)] [&>input]:[accent-color:var(--da-accent-indigo)]">
                    <input type="radio" name="usage_type" checked={usageType === cap} onChange={() => setUsageType(cap)} />
                    <span>{CAP_LABEL[cap] || cap}</span>
                  </label>
                ))}
                {caps.includes('llm') && caps.includes('embedding') && (
                  <label className="flex items-center gap-2 p-2 px-3 bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-md cursor-pointer text-sm text-[var(--da-text-primary)] transition-[border-color] duration-150 hover:border-[var(--da-accent-indigo)] [&>input]:[accent-color:var(--da-accent-indigo)]">
                    <input type="radio" name="usage_type" checked={usageType === 'both'} onChange={() => setUsageType('both')} />
                    <span>{t('workstation.bothSupported')}</span>
                  </label>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2" style={{ marginTop: 4 }}>
                {caps.map((cap) => (
                  <span key={cap} className={`inline-flex items-center px-[10px] py-0.5 rounded text-xs font-semibold tracking-[0.3px] bg-[color-mix(in_srgb,var(--da-accent-${cap === 'llm' ? 'indigo' : 'emerald'})_15%,transparent)] text-[var(--da-accent-${cap === 'llm' ? 'indigo' : 'emerald'})] border border-[color-mix(in_srgb,var(--da-accent-${cap === 'llm' ? 'indigo' : 'emerald'})_30%,transparent)]`}>{CAP_LABEL[cap] || cap}</span>
                ))}
                <span style={{ fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)', marginLeft: 8 }}>
                  {t('workstation.purpose')}: {CAP_LABEL[caps[0]] || caps[0]}
                </span>
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">
              {t('providerEdit.name')}
              <span style={{ fontWeight: 400, color: 'var(--da-text-muted)', fontSize: 'var(--da-font-size-xs)' }}>
                ({t('providerEdit.nameOptional') || 'optional'})
              </span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('providerEdit.placeholders.name')} />
            <p className="text-xs text-[var(--da-text-muted)] mt-2" style={{ marginTop: 4 }}>
              <Tag size={11} /> {t('providerEdit.nameHint') || '用于区分不同的 Key，不填则使用提供商名称'}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">{t('providerEdit.baseUrl')}</label>
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('providerEdit.placeholders.baseUrl')} />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">{t('providerEdit.apiKey')}</label>
            <div className="flex-1 flex items-center bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-md overflow-hidden">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t('providerEdit.placeholders.apiKey')} className="flex-1 bg-transparent border-none px-3 py-2 text-sm text-[var(--da-text-primary)] outline-none [&::placeholder]:text-[var(--da-text-muted)]" />
              <button className="p-2 bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer flex items-center justify-center hover:text-[var(--da-text-primary)]" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide API key' : 'Show API key'}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {showModels && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--da-text-secondary)] mb-2">{t('providerEdit.supportedModels')}</label>
              <div className="flex items-start gap-2">
                {fetchingModels ? (
                  <div className="flex-1 flex items-center gap-2 p-2 bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-md text-[var(--da-text-muted)] text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('workstation.fetchingModels')}</span>
                  </div>
                ) : models.length > 0 ? (
                  <div className="flex-1 flex flex-wrap gap-2 p-2 bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-md min-h-[36px]">
                    {models.map((model) => <span key={model} className="inline-flex items-center px-2 py-0.5 bg-[var(--da-accent-indigo)] text-white rounded text-xs font-medium">{model}</span>)}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center p-2 bg-[var(--da-bg-elevated)] border border-[var(--da-border)] rounded-md text-[var(--da-text-muted)] text-sm"><span>{t('workstation.enterApiKeyToFetch')}</span></div>
                )}
                <button type="button" className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={handleFetchModels}
                  disabled={!apiKey.trim() || fetchingModels} title={t('workstation.fetchFromApi')}>
                  {fetchingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--da-border-subtle)]">
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose}>{t('confirm.cancel')}</button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed" onClick={handleSave} disabled={!name.trim() || !apiKey.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '...' : t('providerEdit.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
