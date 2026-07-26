import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Tag, Loader2, Save } from 'lucide-react';

import { fetchModelsFromProvider } from '../../../api/client/keys';
import { listProviders } from '../../../api/client/providers';
import type { ProvidersMap } from '../../../api/client/providers';
import ProviderSelector from './ProviderSelector';
import CredentialsSection from './CredentialsSection';
import ModelSection from './ModelSection';
import ConnectionTest from './ConnectionTest';
import type { TestResult } from './ConnectionTest';

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
  const [isDefault, setIsDefault] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

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
      if (result.success && result.models.length > 0) {
        setModels((prev) => {
          const merged = new Set([...prev, ...result.models]);
          return Array.from(merged);
        });
      }
    } catch { /* ignore */ }
    finally { setFetchingModels(false); }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const result = await fetchModelsFromProvider({
        api_key: apiKey, base_url: baseUrl || undefined, provider: providerType,
      });
      const latency = Math.round(performance.now() - start);
      setTestResult({
        success: result.success,
        message: result.success ? '连接成功' : (result.message || '未知错误'),
        latency,
      });
    } catch {
      setTestResult({ success: false, message: '连接超时或网络错误', latency: 0 });
    }
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[480px] max-h-[600px] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" onClick={(e) => e.stopPropagation()} ref={contentRef} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[color-mix(in_srgb,var(--color-surface),var(--color-text-primary)_8%)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
              {loadingProviders ? <Loader2 size={16} className="animate-spin" /> : <Tag size={18} />}
            </div>
            <div>
              <h3 className="m-0">{provider.id ? t('providerEdit.edit') : t('providerEdit.add')}</h3>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] leading-tight">
                {providers[providerType]?.base_url || ''}
              </p>
            </div>
          </div>
          <button type="button" className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>

        <div className="flex-1 px-6 py-5 overflow-y-auto">
          <div className="mb-5">
            <ProviderSelector
              providers={providers}
              providerType={providerType}
              usageType={usageType}
              onChangeProvider={setProviderType}
              onChangeUsage={setUsageType}
            />
          </div>

          <div className="mb-5">
            <CredentialsSection
              name={name} baseUrl={baseUrl} apiKey={apiKey}
              isDefault={isDefault} showKey={showKey}
              onChangeName={setName} onChangeBaseUrl={setBaseUrl}
              onChangeApiKey={setApiKey} onChangeIsDefault={setIsDefault}
              onToggleShowKey={() => setShowKey(!showKey)}
            />
          </div>

          {showModels && (
            <div className="mb-5">
              <ModelSection
                models={models} fetching={fetchingModels} apiKey={apiKey}
                onAddModel={(m) => setModels((prev) => [...prev, m])}
                onRemoveModel={(m) => setModels((prev) => prev.filter((x) => x !== m))}
                onFetchModels={handleFetchModels}
              />
            </div>
          )}

          <ConnectionTest
            onTest={handleTestConnection}
            disabled={!apiKey.trim() || testing}
            testing={testing}
            testResult={testResult}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button type="button" className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('confirm.cancel')}</button>
          <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100" onClick={handleSave} disabled={!name.trim() || !apiKey.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '...' : t('providerEdit.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
