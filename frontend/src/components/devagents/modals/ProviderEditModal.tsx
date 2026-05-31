import { useState, useRef, useEffect } from 'react';
import { X, Eye, EyeOff, Save } from 'lucide-react';
import type { ApiProvider } from './ApiManagementModal';
import { useTranslation } from 'react-i18next';

interface Props {
  provider: ApiProvider;
  onSave: (provider: ApiProvider) => void;
  onClose: () => void;
}

export default function ProviderEditModal({ provider, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;
    const modal = contentRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
      firstInput?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);

  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [modelsText, setModelsText] = useState(provider.models.join('\n'));
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    onSave({
      ...provider,
      name,
      baseUrl,
      apiKey,
      models: modelsText.split('\n').map(s => s.trim()).filter(Boolean),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-edit-modal" onClick={e => e.stopPropagation()} ref={contentRef} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{provider.name ? t('providerEdit.edit') : t('providerEdit.add')}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="api-edit-form">
          <div className="form-group">
            <label>{t('providerEdit.name')}</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例如：OpenAI" />
          </div>
          <div className="form-group">
            <label>{t('providerEdit.baseUrl')}</label>
            <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
          </div>
          <div className="form-group">
            <label>{t('providerEdit.apiKey')}</label>
            <div className="api-key-input">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
              <button className="api-key-toggle" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide API key' : 'Show API key'}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>{t('providerEdit.supportedModels')}</label>
            <textarea value={modelsText} onChange={e => setModelsText(e.target.value)} placeholder="gpt-4o&#10;gpt-4o-mini" rows={4} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('confirm.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}><Save size={14} />{t('providerEdit.save')}</button>
        </div>
      </div>
    </div>
  );
}
