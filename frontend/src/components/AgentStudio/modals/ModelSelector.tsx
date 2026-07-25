import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  models: { model: string; keyId: string }[];
  selectedModel: string;
  onSelect: (model: string) => void;
}

export default function ModelSelector({ models, selectedModel, onSelect }: Props) {
  const { t } = useTranslation();

  return (
    <div className="">
      <div className="flex items-center justify-between mb-4">
        <h4>{t('api.defaultModel')}</h4>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] m-0 mb-4">{t('api.selectModel')}</p>
      <div className="flex flex-col gap-2">
        {models.map(({ model }) => (
          <label key={model} className="flex items-center gap-3 p-3 rounded-md cursor-pointer transition-[background] duration-150 hover:bg-[var(--color-surface-hover)]">
            <input
              type="radio"
              name="defaultModel"
              value={model}
              checked={selectedModel === model}
              onChange={() => onSelect(model)}
            />
            <div className="flex flex-col">
              <span className="text-sm text-[var(--color-text-primary)] font-[var(--font-mono)]">{model}</span>
            </div>
          </label>
        ))}
        {models.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)] text-center">
            <AlertCircle size={32} />
            <p>请先在"提供商"标签页配置至少一个有效的 API Key</p>
          </div>
        )}
      </div>
    </div>
  );
}
