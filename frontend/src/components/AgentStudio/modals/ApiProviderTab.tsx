import { useState } from 'react';
import { Key, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, RefreshCw, Pencil, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ToggleSwitch from '../../shared/ToggleSwitch';
import type { KeyItem } from '../../../api/client';

interface Props {
  keys: KeyItem[];
  loading: boolean;
  error: string | null;
  testingId: string | null;
  showApiKey: Record<string, boolean>;
  saving: boolean;
  onAdd: () => void;
  onEdit: (key: KeyItem) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onTest: (key: KeyItem) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDismissError: () => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchToggleActive?: (ids: string[], active: boolean) => void;
}

export default function ApiProviderTab({
  keys,
  loading,
  error,
  testingId,
  showApiKey,
  onAdd,
  onEdit,
  onToggleActive,
  onTest,
  onDelete,
  onToggleVisibility,
  onDismissError,
  onBatchDelete,
  onBatchToggleActive,
}: Props) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === keys.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keys.map((k) => k.id)));
    }
  };

  const handleBatchDelete = () => {
    if (onBatchDelete) onBatchDelete(Array.from(selectedIds));
    else selectedIds.forEach((id) => onDelete(id));
    setSelectedIds(new Set());
  };

  const handleBatchActivate = (active: boolean) => {
    if (onBatchToggleActive) onBatchToggleActive(Array.from(selectedIds), active);
    else selectedIds.forEach((id) => onToggleActive(id, active));
    setSelectedIds(new Set());
  };

  return (
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h4>密钥管理</h4>
        <button className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:opacity-90" onClick={onAdd}>
          <Plus size={14} />
          添加 Key
        </button>
      </div>
      {error && (
        <div className="bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] rounded-lg py-2.5 px-3.5 mb-4 flex items-center gap-2.5">
          <AlertCircle size={15} className="text-[var(--color-danger)] shrink-0" />
          <span className="text-[var(--color-danger)] text-sm flex-1">{error}</span>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors" onClick={onDismissError}>
            ✕
          </button>
        </div>
      )}
      <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
        {t('api.encryptHint')}
      </p>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)] text-center gap-3">
          <Loader2 size={28} className="animate-spin opacity-50" />
          <p className="text-sm">{t('common.loading')}</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)] text-center gap-3">
          <Key size={32} className="opacity-30" />
          <p className="text-sm leading-relaxed">
            {t('api.noKeys')}
            <br />
            {t('api.addKeyHint')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg">
              <span className="text-sm text-[var(--color-text-secondary)]">{selectedIds.size} / {keys.length} 个已选</span>
              <button className="text-xs text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer underline hover:text-[var(--color-text-primary)] transition-colors" onClick={toggleSelectAll}>
                {selectedIds.size === keys.length ? '取消全选' : '全选'}
              </button>
              <div className="flex items-center gap-1.5 ml-auto">
                <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]" onClick={() => handleBatchActivate(true)}>
                  <CheckCircle2 size={13} /> 启用
                </button>
                <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]" onClick={() => handleBatchActivate(false)}>
                  <AlertCircle size={13} /> 禁用
                </button>
                <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border-none transition-all duration-150 bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] text-[var(--color-danger)] hover:bg-[color-mix(in_srgb,var(--color-danger)_20%,transparent)]" onClick={handleBatchDelete}>
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </div>
          )}
          {keys.map((key) => (
            <div key={key.id} className={`bg-[var(--color-surface-raised)] border rounded-lg p-4 transition-all duration-150 ${selectedIds.has(key.id) ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-hover)]'}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <button className="shrink-0 mt-0.5 bg-transparent border-none cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors p-0" onClick={() => toggleSelect(key.id)}>
                    {selectedIds.has(key.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
                      {key.label || key.provider}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide ml-1.5 ${
                      key.usage_type === 'embedding' ? 'bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] text-[var(--color-accent)]' :
                      key.usage_type === 'both' ? 'bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-success)]' :
                      'bg-[color-mix(in_srgb,var(--color-text-muted)_8%,transparent)] text-[var(--color-text-secondary)]'
                    }`}>
                      {key.usage_type === 'both' ? t('api.type_both') : key.usage_type === 'embedding' ? t('api.type_embed') : t('api.type_llm')}
                    </span>
                    {key.is_active ? (
                      <CheckCircle2 size={13} className="text-[var(--color-success)]" />
                    ) : (
                      <AlertCircle size={13} className="text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                    {key.provider}{key.base_url ? ` · ${key.base_url}` : ''}
                  </div>
                </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ToggleSwitch
                    checked={key.is_active}
                    size="sm"
                    onChange={(v) => onToggleActive(key.id, v)}
                  />
                  <button className="inline-flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none transition-all duration-150 bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]" onClick={() => onEdit(key)} title="编辑">
                    <Pencil size={13} />
                  </button>
                  <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none transition-all duration-150 bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]"
                    onClick={() => onTest(key)}
                    disabled={testingId === key.id}
                    title="测试"
                  >
                    {testingId === key.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  </button>
                  <button className="inline-flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none transition-all duration-150 bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-danger)]" onClick={() => onDelete(key.id)} title="删除">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-[var(--color-text-muted)] font-medium shrink-0">Key</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <code className="text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-elevated)] px-2.5 py-1 rounded font-mono truncate">{key.key_masked}</code>
                  <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md cursor-pointer border-none transition-all duration-150 bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] shrink-0"
                    onClick={() => onToggleVisibility(key.id)}
                    title={showApiKey[key.id] ? '隐藏' : '显示'}
                  >
                    {showApiKey[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {key.last_used_at && (
                <div className="text-xs text-[var(--color-text-muted)] mt-2.5">
                  {t('api.lastUsed')}: {new Date(key.last_used_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
