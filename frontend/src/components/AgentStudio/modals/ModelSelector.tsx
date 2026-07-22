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
    <div className="api-models-tab">
      <div className="api-section-header">
        <h4>{t('api.defaultModel')}</h4>
      </div>
      <p className="api-hint">{t('api.selectModel')}</p>
      <div className="api-models-list">
        {models.map(({ model }) => (
          <label key={model} className="api-model-item">
            <input
              type="radio"
              name="defaultModel"
              value={model}
              checked={selectedModel === model}
              onChange={() => onSelect(model)}
            />
            <div className="api-model-info">
              <span className="api-model-name">{model}</span>
            </div>
          </label>
        ))}
        {models.length === 0 && (
          <div className="api-empty-state">
            <AlertCircle size={32} />
            <p>请先在"提供商"标签页配置至少一个有效的 API Key</p>
          </div>
        )}
      </div>
    </div>
  );
}
