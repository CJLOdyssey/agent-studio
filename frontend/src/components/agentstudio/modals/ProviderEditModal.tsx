import { useState, useRef, useEffect } from 'react';
import { X, Eye, EyeOff, Save, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fetchModelsFromProvider } from '../../../api/client/keys';

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

interface ProviderInfo {
  baseUrl: string;
  models: string[];
  capabilities: ('llm' | 'embedding')[];
}

const PROVIDER_INFO: Record<string, ProviderInfo> = {
  openai: { baseUrl: 'https://api.openai.com/v1', models: [], capabilities: ['llm', 'embedding'] },
  deepseek: { baseUrl: 'https://api.deepseek.com', models: [], capabilities: ['llm'] },
  anthropic: { baseUrl: 'https://api.anthropic.com', models: [], capabilities: ['llm'] },
  dashscope: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [],
    capabilities: ['llm', 'embedding'],
  },
  custom: { baseUrl: '', models: [], capabilities: ['llm', 'embedding'] },
};

const CAPABILITY_LABELS: Record<string, string> = {
  llm: 'LLM',
  embedding: 'Embed',
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

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;
    const modal = contentRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      firstInput?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);

  const [providerType, setProviderType] = useState(provider.provider || 'custom');
  const [usageType, setUsageType] = useState(provider.usage_type || 'llm');
  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [models, setModels] = useState<string[]>(provider.models);
  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  const caps = PROVIDER_INFO[providerType]?.capabilities ?? ['llm'];

  const handleProviderChange = (newProvider: string) => {
    setProviderType(newProvider);
    const info = PROVIDER_INFO[newProvider];
    if (info) {
      if (!baseUrl || Object.values(PROVIDER_INFO).some((d) => d.baseUrl === baseUrl)) {
        setBaseUrl(info.baseUrl);
      }
    }
    // Reset usage_type if current selection isn't supported
    if (usageType === 'both' && !info?.capabilities.includes('embedding')) {
      setUsageType('llm');
    }
    if (usageType === 'embedding' && !info?.capabilities.includes('embedding')) {
      setUsageType('llm');
    }
  };

  const handleSave = () => {
    onSave({
      ...provider,
      provider: providerType,
      usage_type: usageType,
      name,
      baseUrl,
      apiKey,
      models,
    });
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setFetchingModels(true);
    try {
      const result = await fetchModelsFromProvider({
        api_key: apiKey,
        base_url: baseUrl || undefined,
        provider: providerType,
      });
      if (result.success && result.models.length > 0) {
        setModels(result.models);
      } else {
        setModels([]);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setModels([]);
    } finally {
      setFetchingModels(false);
    }
  };

  const showModels = usageType === 'llm' || usageType === 'both';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content api-edit-modal"
        onClick={(e) => e.stopPropagation()}
        ref={contentRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{provider.id ? t('providerEdit.edit') : t('providerEdit.add')}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="api-edit-form">
          <div className="form-group">
            <label>{t('providerEdit.provider')}</label>
            <select value={providerType} onChange={(e) => handleProviderChange(e.target.value)}>
              {Object.entries(PROVIDER_INFO).map(([key]) => (
                <option key={key} value={key}>
                  {t(`providerEdit.providers.${key}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>支持能力</label>
            <div className="capability-badges">
              {caps.map((cap) => (
                <span key={cap} className={`capability-badge capability-${cap}`}>
                  {CAPABILITY_LABELS[cap]}
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>用途</label>
            <div className="usage-type-options">
              {caps.map((cap) => (
                <label key={cap} className="usage-type-option">
                  <input
                    type="radio"
                    name="usage_type"
                    checked={usageType === cap}
                    onChange={() => setUsageType(cap)}
                  />
                  <span>{CAPABILITY_LABELS[cap] === 'LLM' ? '聊天模型' : '嵌入模型'}</span>
                </label>
              ))}
              {caps.includes('llm') && caps.includes('embedding') && (
                <label className="usage-type-option">
                  <input
                    type="radio"
                    name="usage_type"
                    checked={usageType === 'both'}
                    onChange={() => setUsageType('both')}
                  />
                  <span>两者都支持</span>
                </label>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>{t('providerEdit.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('providerEdit.placeholders.name')}
            />
          </div>
          <div className="form-group">
            <label>{t('providerEdit.baseUrl')}</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={t('providerEdit.placeholders.baseUrl')}
            />
          </div>
          <div className="form-group">
            <label>{t('providerEdit.apiKey')}</label>
            <div className="api-key-input">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('providerEdit.placeholders.apiKey')}
              />
              <button
                className="api-key-toggle"
                onClick={() => setShowKey(!showKey)}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
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
                    <span>正在获取模型...</span>
                  </div>
                ) : models.length > 0 ? (
                  <div className="models-tags">
                    {models.map((model) => (
                      <span key={model} className="model-tag">
                        {model}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="models-empty">
                    <span>请输入 API Key 后点击刷新按钮获取模型</span>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleFetchModels}
                  disabled={!apiKey.trim() || fetchingModels}
                  title="从 API 获取可用模型"
                >
                  {fetchingModels ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('confirm.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim() || !apiKey.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '...' : t('providerEdit.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
