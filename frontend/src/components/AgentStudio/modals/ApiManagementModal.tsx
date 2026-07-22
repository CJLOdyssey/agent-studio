import { useState, useEffect } from 'react';
import { Key, Server, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../../shared/Modal';
import ProviderEditModal from './ProviderEditModal';
import ApiProviderTab from './ApiProviderTab';
import ApiUsageTab from './ApiUsageTab';
import ModelSelector from './ModelSelector';
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

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('agentstudio-selected-model', model);
    window.dispatchEvent(new Event('agentstudio-model-changed'));
  };

  const TABS = ['providers', 'models', 'usage'] as const;
  const TAB_ICONS: Record<ApiTab, typeof Server> = { providers: Server, models: Globe, usage: Key };

  return (
    <Modal title="API 管理" onClose={onClose} className="api-modal">
      <div className="settings-body">
        <div className="settings-sidebar">
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const label = tab === 'providers' ? t('api.tab_provider') : tab === 'models' ? t('api.tab_model') : t('api.tab_usage');
            return (
              <button
                key={tab}
                className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <div className="settings-content">
          {activeTab === 'providers' && (
            <ApiProviderTab
              keys={keys}
              loading={loading}
              error={error}
              usageTypeFilter={usageTypeFilter}
              testingId={testingId}
              showApiKey={showApiKey}
              saving={saving}
              onFilterChange={setUsageTypeFilter}
              onAdd={showAddForm}
              onEdit={setEditingKey}
              onToggleActive={(id, active) => handleUpdateKey(id, { isActive: active })}
              onTest={handleTestConnection}
              onDelete={handleDeleteKey}
              onToggleVisibility={toggleApiKeyVisibility}
              onDismissError={() => setError(null)}
            />
          )}
          {activeTab === 'models' && (
            <ModelSelector
              models={allModels}
              selectedModel={selectedModel}
              onSelect={handleModelSelect}
            />
          )}
          {activeTab === 'usage' && (
            <ApiUsageTab usage={usage} />
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
