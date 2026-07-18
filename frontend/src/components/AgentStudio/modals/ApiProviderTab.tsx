import { Key, Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../../shared/ToggleSwitch';
import type { KeyItem } from '../../../api/client';

interface Props {
  keys: KeyItem[];
  loading: boolean;
  error: string | null;
  usageTypeFilter: 'all' | 'llm' | 'embedding' | 'both';
  testingId: string | null;
  showApiKey: Record<string, boolean>;
  saving: boolean;
  onFilterChange: (filter: 'all' | 'llm' | 'embedding' | 'both') => void;
  onAdd: () => void;
  onEdit: (key: KeyItem) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onTest: (key: KeyItem) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDismissError: () => void;
}

const FILTERS = ['all', 'llm', 'embedding', 'both'] as const;

export default function ApiProviderTab({
  keys,
  loading,
  error,
  usageTypeFilter,
  testingId,
  showApiKey,
  onFilterChange,
  onAdd,
  onEdit,
  onToggleActive,
  onTest,
  onDelete,
  onToggleVisibility,
  onDismissError,
}: Props) {
  const { t } = useTranslation();

  const typeLabel = (type: (typeof FILTERS)[number]) => {
    switch (type) {
      case 'all': return '全部';
      case 'llm': return 'LLM';
      case 'embedding': return t('api.type_embed');
      case 'both': return t('api.type_both');
    }
  };

  return (
    <div className="api-providers-tab">
      <div className="api-section-header">
        <h4>API Key {t('api.manage')}</h4>
        <button className="btn btn-sm btn-primary" onClick={onAdd}>
          <Plus size={14} />
          添加 Key
        </button>
      </div>
      {error && (
        <div className="api-error-banner">
          <AlertCircle size={16} className="api-error-icon" />
          <span className="api-error-text">{error}</span>
          <button className="api-error-close" onClick={onDismissError}>
            ✕
          </button>
        </div>
      )}
      <p className="api-hint-row">
        {t('api.encryptHint')}
      </p>
      <div className="api-filter-bar">
        {FILTERS.map((type) => (
          <button
            key={type}
            className={`api-filter-btn ${usageTypeFilter === type ? 'active' : ''}`}
            onClick={() => onFilterChange(type)}
          >
            {typeLabel(type)}
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
                    onChange={(v) => onToggleActive(key.id, v)}
                  />
                  <button className="btn btn-sm btn-ghost" onClick={() => onEdit(key)}>
                    编辑
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onTest(key)}
                    disabled={testingId === key.id}
                  >
                    {testingId === key.id ? <Loader2 size={14} className="animate-spin" /> : t('api.test')}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => onDelete(key.id)}>
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
                    onClick={() => onToggleVisibility(key.id)}
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
  );
}
