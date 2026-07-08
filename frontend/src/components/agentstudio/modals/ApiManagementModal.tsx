import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Server, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../../shared/Modal';
import ToggleSwitch from '../../shared/ToggleSwitch';
import ProviderEditModal from './ProviderEditModal';
import * as api from '../../../api/client';
import type { KeyItem } from '../../../api/client';
import Logger from '../../../utils/logger';

interface Props {
  onClose: () => void;
}

type ApiTab = 'providers' | 'models' | 'usage';

export default function ApiManagementModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ApiTab>('providers');
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<KeyItem | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return localStorage.getItem('agentstudio-selected-model') || '';
    } catch {
      return '';
    }
  });
  const [usage, setUsage] = useState({ today_requests: 0, today_tokens: 0, month_requests: 0, month_tokens: 0 });
  const [usageTypeFilter, setUsageTypeFilter] = useState<'all' | 'llm' | 'embedding' | 'both'>('all');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Load keys from server vault ──────────────────────────────────────────
  const loadKeys = async () => {
    try {
      setLoading(true);
      const serverKeys = await api.listKeys();
      setKeys(serverKeys);
    } catch (err) {
      Logger.warn('Failed to load API keys from server', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .listKeys()
      .then((serverKeys) => {
        if (!cancelled) setKeys(serverKeys);
      })
      .catch((err) => Logger.warn('Failed to load API keys from server', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getKeyUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [keys]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveKey = async (keyData: {
    provider: string;
    usage_type?: string;
    label: string;
    apiKey: string;
    baseUrl: string;
    models: string[];
    isDefault: boolean;
  }) => {
    setError(null);
    setSaving(true);
    try {
      await api.createKey({
        provider: keyData.provider,
        usage_type: keyData.usage_type,
        label: keyData.label,
        api_key: keyData.apiKey,
        base_url: keyData.baseUrl || undefined,
        models: keyData.models,
        is_default: keyData.isDefault,
      });
      await loadKeys();
      setEditingKey(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('api.saveFailed');
      setError(msg);
      Logger.error('Failed to save API key', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKey = async (
    id: string,
    updates: {
      usage_type?: string;
      label?: string;
      apiKey?: string;
      baseUrl?: string;
      models?: string[];
      isActive?: boolean;
      isDefault?: boolean;
    },
  ) => {
    setError(null);
    try {
      await api.updateKey(id, {
        label: updates.label,
        api_key: updates.apiKey,
        base_url: updates.baseUrl,
        models: updates.models,
        is_active: updates.isActive,
        is_default: updates.isDefault,
      });
      await loadKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('api.updateFailed');
      setError(msg);
      Logger.error('Failed to update API key', err);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定要删除此 API Key 吗？此操作不可撤销。')) return;
    setError(null);
    try {
      await api.deleteKey(id);
      await loadKeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('api.deleteFailed');
      setError(msg);
      Logger.error('Failed to delete API key', err);
    }
  };

  const handleTestConnection = async (key: KeyItem) => {
    setTestingId(key.id);
    try {
      const result = await api.testKeyConnection(key.id);
      if (result.success) {
        alert(t('api.testSuccess'));
      } else {
        alert(t('api.testFail') + ': ' + result.message);
      }
    } catch {
      alert(t('api.testError'));
    }
    setTestingId(null);
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKey((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Collect models from all active keys
  const allModels = keys.filter((k) => k.is_active).flatMap((k) => k.models.map((m) => ({ model: m, keyId: k.id })));

  const showAddForm = () => {
    setEditingKey({
      id: '',
      provider: 'custom',
      usage_type: 'llm',
      label: '',
      key_masked: '',
      base_url: '',
      models: [],
      is_active: true,
      is_default: keys.length === 0,
      last_used_at: null,
      created_at: null,
    });
  };

  return (
    <Modal title="API 管理" onClose={onClose} className="api-modal">
      <div className="settings-body">
        <div className="settings-sidebar">
          {(['providers', 'models', 'usage'] as const).map((tab) => {
            const icons = { providers: Server, models: Globe, usage: Key };
            const Icon = icons[tab];
            return (
              <button
                key={tab}
                className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={16} />
                <span>
                    {tab === 'providers'
                      ? t('api.tab_provider')
                      : tab === 'models'
                        ? t('api.tab_model')
                        : t('api.tab_usage')}
                  </span>
              </button>
            );
          })}
        </div>
        <div className="settings-content">
          {activeTab === 'providers' && (
            <div className="api-providers-tab">
              <div className="api-section-header">
                <h4>API Key {t('api.manage')}</h4>
                <button className="btn btn-sm btn-primary" onClick={showAddForm}>
                  <Plus size={14} />
                  添加 Key
                </button>
              </div>
              {error && (
                <div className="api-error-banner">
                  <AlertCircle size={16} className="api-error-icon" />
                  <span className="api-error-text">{error}</span>
                  <button className="api-error-close" onClick={() => setError(null)}>
                    ✕
                  </button>
                </div>
              )}
              <p className="api-hint-row">
                {t('api.encryptHint')}
              </p>
              {/* Usage type filter */}
              <div className="api-filter-bar">
                {(['all', 'llm', 'embedding', 'both'] as const).map((type) => (
                  <button
                    key={type}
                    className={`api-filter-btn ${usageTypeFilter === type ? 'active' : ''}`}
                    onClick={() => setUsageTypeFilter(type)}
                  >
                    {type === 'all' ? '全部' : type === 'llm' ? 'LLM' : type === 'embedding' ? t('api.type_embed') : t('api.type_both')}
                  </button>
                ))}
              </div>
              {loading ? (
                <div className="api-empty-state">
                  <Loader2 size={32} className="animate-spin" />
                  <p>{t('common.loading')}</p>
                </div>
              ) : keys.length === 0 ? (
                <div className="api-empty-state">
                  <Key size={32} />
                  <p>
                    {t('api.noKeys')}
                    <br />
                    {t('api.addKeyHint')}
                  </p>
                </div>
              ) : (
                <div className="api-providers-list">
                  {keys.filter((k) => usageTypeFilter === 'all' || k.usage_type === usageTypeFilter).map((key) => (
                    <div key={key.id} className={`api-provider-card ${key.is_active ? 'active' : ''}`}>
                      <div className="api-provider-header">
                        <div className="api-provider-info">
                          <div className="api-provider-name">
                            {key.label || key.provider}
                            <span className={`api-type-badge api-type-${key.usage_type || 'llm'}`}>
                              {key.usage_type === 'both' ? t('api.type_both') : key.usage_type === 'embedding' ? t('api.type_embed') : t('api.type_llm')}
                            </span>
                            {key.is_active && <CheckCircle2 size={14} className="text-green-500" />}
                            {!key.is_active && <AlertCircle size={14} className="text-red-500" />}
                          </div>
                          <div className="api-provider-url">
                            {key.provider} {key.base_url ? `· ${key.base_url}` : ''}
                          </div>
                        </div>
                        <div className="api-provider-actions">
                          <ToggleSwitch
                            checked={key.is_active}
                            size="sm"
                            onChange={(v) => handleUpdateKey(key.id, { isActive: v })}
                          />
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditingKey(key)}>
                            编辑
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleTestConnection(key)}
                            disabled={testingId === key.id}
                          >
                            {testingId === key.id ? <Loader2 size={14} className="animate-spin" /> : t('api.test')}
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteKey(key.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="api-key-row">
                        <label>Key</label>
                        <div className="api-key-display">
                          <code>{key.key_masked}</code>
                          <button
                            className="api-key-toggle"
                            onClick={() => toggleApiKeyVisibility(key.id)}
                            aria-label="Show full key hint"
                          >
                            {showApiKey[key.id] ? '🔒' : '👁'}
                          </button>
                        </div>
                      </div>
                      {key.last_used_at && (
                        <div className="api-key-meta">{t('api.lastUsed')}: {new Date(key.last_used_at).toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'models' && (
            <div className="api-models-tab">
              <div className="api-section-header">
                <h4>{t('api.defaultModel')}</h4>
              </div>
              <p className="api-hint">{t('api.selectModel')}</p>
              <div className="api-models-list">
                {allModels.map(({ model }) => (
                  <label key={model} className="api-model-item">
                    <input
                      type="radio"
                      name="defaultModel"
                      value={model}
                      checked={selectedModel === model}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        localStorage.setItem('agentstudio-selected-model', e.target.value);
                        window.dispatchEvent(new Event('agentstudio-model-changed'));
                      }}
                    />
                    <div className="api-model-info">
                      <span className="api-model-name">{model}</span>
                    </div>
                  </label>
                ))}
                {allModels.length === 0 && (
                  <div className="api-empty-state">
                    <AlertCircle size={32} />
                    <p>请先在"提供商"标签页配置至少一个有效的 API Key</p>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'usage' && (
            <div className="api-usage-tab">
              <div className="api-section-header">
                <h4>{t('api.usageStats')}</h4>
              </div>
              <div className="api-usage-cards">
                <div className="api-usage-card">
                  <div className="api-usage-value">{usage.today_requests}</div>
                  <div className="api-usage-label">{t('api.todayRequests')}</div>
                </div>
                <div className="api-usage-card">
                  <div className="api-usage-value">{usage.today_tokens.toLocaleString()}</div>
                  <div className="api-usage-label">{t('api.todayTokens')}</div>
                </div>
                <div className="api-usage-card">
                  <div className="api-usage-value">{usage.month_requests}</div>
                  <div className="api-usage-label">{t('api.monthRequests')}</div>
                </div>
                <div className="api-usage-card">
                  <div className="api-usage-value">{usage.month_tokens.toLocaleString()}</div>
                  <div className="api-usage-label">{t('api.monthTokens')}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {editingKey && (
        <ProviderEditModal
          provider={{
            id: editingKey.id,
            provider: editingKey.provider,
            usage_type: editingKey.usage_type || 'llm',
            name: editingKey.label || editingKey.provider,
            baseUrl: editingKey.base_url || '',
            apiKey: '',
            models: editingKey.models,
            isActive: editingKey.is_active,
            status: 'untested' as const,
          }}
          saving={saving}
          onSave={async (form) => {
            if (editingKey.id) {
              await handleUpdateKey(editingKey.id, {
                label: form.name,
                usage_type: form.usage_type,
                apiKey: form.apiKey || undefined,
                baseUrl: form.baseUrl || undefined,
                models: form.models,
                isDefault: editingKey.is_default,
              });
            } else {
              await handleSaveKey({
                provider: form.provider,
                usage_type: form.usage_type,
                label: form.name,
                apiKey: form.apiKey,
                baseUrl: form.baseUrl,
                models: form.models,
                isDefault: keys.length === 0,
              });
            }
          }}
          onClose={() => {
            if (!saving) setEditingKey(null);
          }}
        />
      )}
    </Modal>
  );
}
