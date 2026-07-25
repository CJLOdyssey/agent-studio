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
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h4>API Key {t('api.manage')}</h4>
        <button className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={onAdd}>
          <Plus size={14} />
          添加 Key
        </button>
      </div>
      {error && (
        <div className="bg-[color-mix(in_srgb,var(--da-accent-red)_15%,transparent)] border border-[color-mix(in_srgb,var(--da-accent-red)_30%,transparent)] rounded-lg py-2 px-3 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-[var(--da-accent-red)] shrink-0" />
          <span className="text-[var(--da-accent-red)] text-sm">{error}</span>
          <button className="ml-auto bg-transparent border-none text-[var(--da-accent-red)] cursor-pointer px-1 py-0.5 text-base leading-none hover:text-[var(--da-text-on-accent)]" onClick={onDismissError}>
            ✕
          </button>
        </div>
      )}
      <p className="flex items-center gap-1.5 mb-3">
        {t('api.encryptHint')}
      </p>
      <div className="flex gap-1.5 mb-4">
        {FILTERS.map((type) => (
          <button
            key={type}
            className={`px-3.5 py-[5px] border border-[var(--color-border)] rounded-md bg-transparent text-[var(--color-text-muted)] text-xs font-[450] cursor-pointer transition-all duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] ${usageTypeFilter === type ? 'active' : ''}`}
            onClick={() => onFilterChange(type)}
          >
            {typeLabel(type)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)] text-center">
          <Loader2 size={32} className="animate-spin" />
          <p>{t('common.loading')}</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)] text-center">
          <Key size={32} />
          <p>
            {t('api.noKeys')}
            <br />
            {t('api.addKeyHint')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {keys.filter((k) => usageTypeFilter === 'all' || k.usage_type === usageTypeFilter).map((key) => (
            <div key={key.id} className={`bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg p-4 transition-[border-color] duration-150 ${key.is_active ? 'active' : ''}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[var(--da-font-size-base)] font-semibold text-[var(--color-text-primary)]">
                    {key.label || key.provider}
                    <span className={`inline-flex items-center px-[7px] py-px rounded text-[10px] font-medium leading-[1.5] tracking-[0.02em] uppercase ml-2 api-type-${key.usage_type || 'llm'}`}>
                      {key.usage_type === 'both' ? t('api.type_both') : key.usage_type === 'embedding' ? t('api.type_embed') : t('api.type_llm')}
                    </span>
                    {key.is_active && <CheckCircle2 size={14} className="text-[var(--color-accent)]" />}
                    {!key.is_active && <AlertCircle size={14} className="text-[var(--icon-status-error)]" />}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                    {key.provider} {key.base_url ? `· ${key.base_url}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ToggleSwitch
                    checked={key.is_active}
                    size="sm"
                    onChange={(v) => onToggleActive(key.id, v)}
                  />
                  <button className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]" onClick={() => onEdit(key)}>
                    编辑
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]"
                    onClick={() => onTest(key)}
                    disabled={testingId === key.id}
                  >
                    {testingId === key.id ? <Loader2 size={14} className="animate-spin" /> : t('api.test')}
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]" onClick={() => onDelete(key.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label>Key</label>
                <div className="flex items-center gap-2 [&>code]:text-sm [&>code]:text-[var(--color-text-primary)] [&>code]:bg-[var(--color-surface-elevated)] [&>code]:px-2 [&>code]:py-0.5 [&>code]:rounded">
                  <code>{key.key_masked}</code>
                  <button
                    className="p-2 bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center hover:text-[var(--color-text-primary)]"
                    onClick={() => onToggleVisibility(key.id)}
                    aria-label="Show full key hint"
                  >
                    {showApiKey[key.id] ? '🔒' : '👁'}
                  </button>
                </div>
              </div>
              {key.last_used_at && (
                <div className="text-xs text-[var(--color-text-muted)] mt-2">{t('api.lastUsed')}: {new Date(key.last_used_at).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
