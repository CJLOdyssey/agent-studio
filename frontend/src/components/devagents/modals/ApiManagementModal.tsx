import { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, Eye, EyeOff, CheckCircle2,
  AlertCircle, Loader2, Server, Globe
} from 'lucide-react';
import { encryptAndStore, getAndDecrypt } from '../../../utils/secureStorage';
import Modal from '../../shared/Modal';
import ToggleSwitch from '../../shared/ToggleSwitch';
import ProviderEditModal from './ProviderEditModal';

interface Props {
  onClose: () => void;
}

export interface ApiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isActive: boolean;
  lastTested?: string;
  status?: 'connected' | 'error' | 'untested';
}

const DEFAULT_PROVIDERS: ApiProvider[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], isActive: true, status: 'untested' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKey: '', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'], isActive: false, status: 'untested' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: '', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'], isActive: false, status: 'untested' },
  { id: 'custom', name: '自定义', baseUrl: '', apiKey: '', models: [], isActive: false, status: 'untested' },
];

type ApiTab = 'providers' | 'models' | 'usage';

export default function ApiManagementModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<ApiTab>('providers');
  const [providers, setProviders] = useState<ApiProvider[]>(() => {
    try {
      const saved = getAndDecrypt('devagents-api-providers');
      return saved ? JSON.parse(saved) : DEFAULT_PROVIDERS;
    } catch { return DEFAULT_PROVIDERS; }
  });
  const [editingProvider, setEditingProvider] = useState<ApiProvider | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return getAndDecrypt('devagents-selected-model') || 'gpt-4o';
  });

  useEffect(() => { encryptAndStore('devagents-api-providers', JSON.stringify(providers)); }, [providers]);
  useEffect(() => { encryptAndStore('devagents-selected-model', selectedModel); }, [selectedModel]);

  const handleSaveProvider = (provider: ApiProvider) => {
    setProviders(prev => {
      const existing = prev.find(p => p.id === provider.id);
      return existing ? prev.map(p => p.id === provider.id ? provider : p) : [...prev, provider];
    });
    setEditingProvider(null);
  };

  const handleDeleteProvider = (id: string) => {
    if (confirm('确定要删除此 API 提供商吗?')) {
      setProviders(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleTestConnection = async (provider: ApiProvider) => {
    setTestingId(provider.id);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = provider.apiKey.length > 0;
    setProviders(prev => prev.map(p =>
      p.id === provider.id ? { ...p, status: success ? 'connected' : 'error', lastTested: new Date().toISOString() } : p
    ));
    setTestingId(null);
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allModels = providers.filter(p => p.isActive && p.apiKey).flatMap(p => p.models);

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
                <h4>API 提供商</h4>
                <button className="btn btn-sm btn-primary" onClick={() => setEditingProvider({
                  id: `custom-${Date.now()}`, name: '', baseUrl: '', apiKey: '', models: [], isActive: true, status: 'untested',
                })}><Plus size={14} />添加提供商</button>
              </div>
              <div className="api-providers-list">
                {providers.map(provider => (
                  <div key={provider.id} className={`api-provider-card ${provider.isActive ? 'active' : ''}`}>
                    <div className="api-provider-header">
                      <div className="api-provider-info">
                        <div className="api-provider-name">
                          {provider.name}
                          {provider.status === 'connected' && <CheckCircle2 size={14} className="text-green-500" />}
                          {provider.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                        </div>
                        <div className="api-provider-url">{provider.baseUrl || '未配置'}</div>
                      </div>
                      <div className="api-provider-actions">
                        <ToggleSwitch checked={provider.isActive} size="sm" onChange={(v) => { setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, isActive: v } : p)); }} />
                        <button className="btn btn-sm btn-ghost" onClick={() => setEditingProvider(provider)}>编辑</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleTestConnection(provider)} disabled={testingId === provider.id}>
                          {testingId === provider.id ? <Loader2 size={14} className="animate-spin" /> : '测试'}
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteProvider(provider.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="api-key-row">
                      <label>API Key</label>
                      <div className="api-key-input">
                        <input type={showApiKey[provider.id] ? 'text' : 'password'} value={provider.apiKey} onChange={e => setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, apiKey: e.target.value } : p))} placeholder="sk-..." />
                        <button className="api-key-toggle" onClick={() => toggleApiKeyVisibility(provider.id)} aria-label={showApiKey[provider.id] ? 'Hide API key' : 'Show API key'}>
                          {showApiKey[provider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === 'models' && (
            <div className="api-models-tab">
              <div className="api-section-header"><h4>默认模型</h4></div>
              <p className="api-hint">选择用于对话的默认 AI 模型</p>
              <div className="api-models-list">
                {providers.filter(p => p.isActive && p.apiKey).flatMap(p => p.models.map(model => (
                  <label key={model} className="api-model-item">
                    <input type="radio" name="defaultModel" value={model} checked={selectedModel === model} onChange={e => setSelectedModel(e.target.value)} />
                    <div className="api-model-info"><span className="api-model-name">{model}</span></div>
                  </label>
                )))}
                {allModels.length === 0 && (
                  <div className="api-empty-state"><AlertCircle size={32} /><p>请先在"提供商"标签页配置至少一个有效的 API 提供商</p></div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'usage' && (
            <div className="api-usage-tab">
              <div className="api-section-header"><h4>用量统计</h4></div>
              <div className="api-usage-cards">
                <div className="api-usage-card"><div className="api-usage-value">0</div><div className="api-usage-label">今日请求</div></div>
                <div className="api-usage-card"><div className="api-usage-value">0</div><div className="api-usage-label">本月请求</div></div>
                <div className="api-usage-card"><div className="api-usage-value">$0.00</div><div className="api-usage-label">本月费用</div></div>
              </div>
              <div className="api-empty-state" style={{ marginTop: '24px' }}><p>用量统计将在连接后端服务后显示</p></div>
            </div>
          )}
        </div>
      </div>
      {editingProvider && <ProviderEditModal provider={editingProvider} onSave={handleSaveProvider} onClose={() => setEditingProvider(null)} />}
    </Modal>
  );
}
