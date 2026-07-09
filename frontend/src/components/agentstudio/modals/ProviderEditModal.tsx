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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-edit-modal provider-edit-modal" onClick={(e) => e.stopPropagation()} ref={contentRef} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="provider-edit-avatar">
              {loadingProviders ? <Loader2 size={16} className="animate-spin" /> : <Tag size={18} />}
            </div>
            <div>
              <h3 style={{ margin: 0 }}>{provider.id ? t('providerEdit.edit') : t('providerEdit.add')}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)' }}>
                {providers[providerType]?.base_url || ''}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="api-edit-form">
          <div className="api-edit-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>{t('providerEdit.provider')}</label>
              <select value={providerType} onChange={(e) => setProviderType(e.target.value)}>
                {Object.entries(providers).map(([key, info]) => (
                  <option key={key} value={key}>{info.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('workstation.capabilities')}</label>
              <div className="capability-badges" style={{ marginTop: 4 }}>
                {caps.map((cap) => (
                  <span key={cap} className={`capability-badge capability-${cap}`}>{CAP_LABEL[cap] || cap}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>{t('workstation.purpose')}</label>
            {multipleCaps ? (
              <div className="usage-type-options">
                {caps.map((cap) => (
                  <label key={cap} className="usage-type-option">
                    <input type="radio" name="usage_type" checked={usageType === cap} onChange={() => setUsageType(cap)} />
                    <span>{CAP_LABEL[cap] || cap}</span>
                  </label>
                ))}
                {caps.includes('llm') && caps.includes('embedding') && (
                  <label className="usage-type-option">
                    <input type="radio" name="usage_type" checked={usageType === 'both'} onChange={() => setUsageType('both')} />
                    <span>{t('workstation.bothSupported')}</span>
                  </label>
                )}
              </div>
            ) : (
              <div className="usage-type-static" style={{ marginTop: 4 }}>
                <span className={`capability-badge capability-${caps[0]}`}>{CAP_LABEL[caps[0]] || caps[0]}</span>
                <span style={{ fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)', marginLeft: 8 }}>
                  {t('workstation.purpose')}: {CAP_LABEL[caps[0]] || caps[0]}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>
              {t('providerEdit.name')}
              <span style={{ fontWeight: 400, color: 'var(--da-text-muted)', fontSize: 'var(--da-font-size-xs)' }}>
                ({t('providerEdit.nameOptional') || 'optional'})
              </span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('providerEdit.placeholders.name')} />
            <p className="form-hint" style={{ marginTop: 4 }}>
              <Tag size={11} /> {t('providerEdit.nameHint') || '用于区分不同的 Key，不填则使用提供商名称'}
            </p>
          </div>

          <div className="form-group">
            <label>{t('providerEdit.baseUrl')}</label>
            <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('providerEdit.placeholders.baseUrl')} />
          </div>

          <div className="form-group">
            <label>{t('providerEdit.apiKey')}</label>
            <div className="api-key-input">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t('providerEdit.placeholders.apiKey')} />
              <button className="api-key-toggle" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide API key' : 'Show API key'}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {showModels && (
            <div className="form-group">
              <label>{t('providerEdit.supportedModels')}</label>
              <div className="models-display">
                {fetchingModels ? (
                  <div className="models-loading">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t('workstation.fetchingModels')}</span>
                  </div>
                ) : models.length > 0 ? (
                  <div className="models-tags">
                    {models.map((model) => <span key={model} className="model-tag">{model}</span>)}
                  </div>
                ) : (
                  <div className="models-empty"><span>{t('workstation.enterApiKeyToFetch')}</span></div>
                )}
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleFetchModels}
                  disabled={!apiKey.trim() || fetchingModels} title={t('workstation.fetchFromApi')}>
                  {fetchingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('confirm.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim() || !apiKey.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '...' : t('providerEdit.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
