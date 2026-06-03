import { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Server, Globe, Shield
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<ApiTab>('providers');
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<KeyItem | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try { return localStorage.getItem('devagents-selected-model') || ''; }
    catch { return ''; }
  });
  const [usage, setUsage] = useState({ today_requests: 0, today_tokens: 0, month_requests: 0, month_tokens: 0 });
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

  useEffect(() => { loadKeys(); }, []);

  // Load usage stats
  useEffect(() => {
    api.getKeyUsage().then(setUsage).catch(() => {});
  }, [keys]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveKey = async (keyData: { provider: string; label: string; apiKey: string; baseUrl: string; models: string[]; isDefault: boolean }) => {
    setError(null);
    setSaving(true);
    try {
      await api.createKey({
        provider: keyData.provider,
        label: keyData.label,
        api_key: keyData.apiKey,
        base_url: keyData.baseUrl || undefined,
        models: keyData.models,
        is_default: keyData.isDefault,
      });
      await loadKeys();
      setEditingKey(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败，请检查网络连接';
      setError(msg);
      Logger.error('Failed to save API key', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateKey = async (id: string, updates: { label?: string; apiKey?: string; baseUrl?: string; models?: string[]; isActive?: boolean; isDefault?: boolean }) => {
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
      const msg = err instanceof Error ? err.message : '更新失败';
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
      const msg = err instanceof Error ? err.message : '删除失败';
      setError(msg);
      Logger.error('Failed to delete API key', err);
    }
  };

  const handleTestConnection = async (key: KeyItem) => {
    setTestingId(key.id);
    try {
      const result = await api.testKeyConnection(key.id);
      if (result.success) {
        alert('✅ 连接成功');
      } else {
        alert('❌ 连接失败: ' + result.message);
      }
    } catch (err) {
      alert('❌ 测试请求失败');
    }
    setTestingId(null);
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Collect models from all active keys
  const allModels = keys
    .filter(k => k.is_active)
    .flatMap(k => k.models.map(m => ({ model: m, keyId: k.id })));

  const showAddForm = () => {
    setEditingKey({
      id: '',
      provider: 'custom',
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
          {(['providers', 'models', 'usage'] as const).map(tab => {
            const icons = { providers: Server, models: Globe, usage: Key };
            const Icon = icons[tab];
            return (
              <button key={tab} className={`settings-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                <Icon size={16} /><span>{tab === 'providers' ? '提供商' : tab === 'models' ? '模型' : '用量'}</span>
              </button>
            );
          })}
        </div>
        <div className="settings-content">
          {activeTab === 'providers' && (
            <div className="api-providers-tab">
              <div className="api-section-header">
                <h4>API Key 管理</h4>
                <button className="btn btn-sm btn-primary" onClick={showAddForm}><Plus size={14} />添加 Key</button>
              </div>
              {error && (
                <div className="api-error-banner" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
                  <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
                </div>
              )}
              <p className="api-hint" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Shield size={14} /> Key 加密存储在服务端，永不出站。仅显示前后各几位以供识别。
              </p>
              {loading ? (
                <div className="api-empty-state"><Loader2 size={32} className="animate-spin" /><p>加载中...</p></div>
              ) : keys.length === 0 ? (
                <div className="api-empty-state"><Key size={32} /><p>尚未配置 API Key<br />点击"添加 Key"开始</p></div>
              ) : (
                <div className="api-providers-list">
                  {keys.map(key => (
                    <div key={key.id} className={`api-provider-card ${key.is_active ? 'active' : ''}`}>
                      <div className="api-provider-header">
                        <div className="api-provider-info">
                          <div className="api-provider-name">
                            {key.label || key.provider}
                            {key.is_active && <CheckCircle2 size={14} className="text-green-500" />}
                            {!key.is_active && <AlertCircle size={14} className="text-red-500" />}
                          </div>
                          <div className="api-provider-url">{key.provider} {key.base_url ? `· ${key.base_url}` : ''}</div>
                        </div>
                        <div className="api-provider-actions">
                          <ToggleSwitch checked={key.is_active} size="sm" onChange={(v) => handleUpdateKey(key.id, { isActive: v })} />
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditingKey(key)}>编辑</button>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleTestConnection(key)} disabled={testingId === key.id}>
                            {testingId === key.id ? <Loader2 size={14} className="animate-spin" /> : '测试'}
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteKey(key.id)}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="api-key-row">
                        <label>Key</label>
                        <div className="api-key-display">
                          <code>{key.key_masked}</code>
                          <button className="api-key-toggle" onClick={() => toggleApiKeyVisibility(key.id)} aria-label="Show full key hint">
                            {showApiKey[key.id] ? '🔒' : '👁'}
                          </button>
                        </div>
                      </div>
                      {key.last_used_at && (
                        <div className="api-key-meta">上次使用: {new Date(key.last_used_at).toLocaleString()}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'models' && (
            <div className="api-models-tab">
              <div className="api-section-header"><h4>默认模型</h4></div>
              <p className="api-hint">选择用于对话的默认 AI 模型</p>
              <div className="api-models-list">
                {allModels.map(({ model }) => (
                  <label key={model} className="api-model-item">
                    <input
                      type="radio" name="defaultModel" value={model}
                      checked={selectedModel === model}
                      onChange={e => { setSelectedModel(e.target.value); localStorage.setItem('devagents-selected-model', e.target.value); }}
                    />
                    <div className="api-model-info"><span className="api-model-name">{model}</span></div>
                  </label>
                ))}
                {allModels.length === 0 && (
                  <div className="api-empty-state"><AlertCircle size={32} /><p>请先在"提供商"标签页配置至少一个有效的 API Key</p></div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'usage' && (
            <div className="api-usage-tab">
              <div className="api-section-header"><h4>用量统计</h4></div>
              <div className="api-usage-cards">
                <div className="api-usage-card"><div className="api-usage-value">{usage.today_requests}</div><div className="api-usage-label">今日请求</div></div>
                <div className="api-usage-card"><div className="api-usage-value">{usage.today_tokens.toLocaleString()}</div><div className="api-usage-label">今日 Token</div></div>
                <div className="api-usage-card"><div className="api-usage-value">{usage.month_requests}</div><div className="api-usage-label">本月请求</div></div>
                <div className="api-usage-card"><div className="api-usage-value">{usage.month_tokens.toLocaleString()}</div><div className="api-usage-label">本月 Token</div></div>
              </div>
            </div>
          )}
        </div>
      </div>
      {editingKey && (
        <ProviderEditModal
          provider={{
            id: editingKey.provider,
            name: editingKey.label || editingKey.provider,
            baseUrl: editingKey.base_url || '',
            apiKey: '',
            models: editingKey.models,
            isActive: editingKey.is_active,
            status: 'untested' as const,
          }}
          saving={saving}
          onSave={async (provider) => {
            if (editingKey.id) {
              await handleUpdateKey(editingKey.id, {
                label: provider.name,
                apiKey: provider.apiKey || undefined,
                baseUrl: provider.baseUrl || undefined,
                models: provider.models,
                isDefault: editingKey.is_default,
              });
            } else {
              await handleSaveKey({
                provider: provider.id,
                label: provider.name,
                apiKey: provider.apiKey,
                baseUrl: provider.baseUrl,
                models: provider.models,
                isDefault: keys.length === 0,
              });
            }
          }}
          onClose={() => { if (!saving) setEditingKey(null); }}
        />
      )}
    </Modal>
  );
}
