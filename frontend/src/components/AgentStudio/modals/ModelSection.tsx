import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, Plus, X } from 'lucide-react';

interface Props {
  models: string[];
  fetching: boolean;
  apiKey: string;
  onAddModel: (model: string) => void;
  onRemoveModel: (model: string) => void;
  onFetchModels: () => void;
}

export default function ModelSection({
  models, fetching, apiKey,
  onAddModel, onRemoveModel, onFetchModels,
}: Props) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newModel, setNewModel] = useState('');

  const handleAdd = () => {
    const trimmed = newModel.trim();
    if (trimmed && !models.includes(trimmed)) {
      onAddModel(trimmed);
    }
    setNewModel('');
    setAdding(false);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.supportedModels')}</label>
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          {models.length > 0 ? (
            <div className="flex-1 flex flex-wrap gap-2 p-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md min-h-[36px]">
              {models.map((model) => (
                <span key={model} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-accent)] text-white rounded text-xs font-medium group">
                  {model}
                  <button type="button" onClick={() => onRemoveModel(model)}
                    className="p-0 bg-transparent border-none text-white/60 cursor-pointer hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center p-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] text-sm">
              <span>{apiKey ? '暂无模型，点击刷新或手动添加' : t('workstation.enterApiKeyToFetch')}</span>
            </div>
          )}
          <button type="button" onClick={onFetchModels}
            disabled={!apiKey.trim() || fetching}
            title={t('workstation.fetchFromApi')}
            className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed">
            {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {adding ? (
            <div className="flex items-center gap-1">
              <input type="text" value={newModel} onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="输入模型 ID"
                autoFocus
                className="w-40 py-1 px-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]" />
              <button type="button" onClick={handleAdd}
                className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)] text-white border-none cursor-pointer">添加</button>
              <button type="button" onClick={() => { setAdding(false); setNewModel(''); }}
                className="px-2 py-1 rounded text-xs text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer border-none bg-transparent text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] transition-colors">
              <Plus size={12} /> 手动添加
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
