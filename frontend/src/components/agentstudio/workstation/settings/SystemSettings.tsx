import { useState } from 'react';
import { Save, Settings, CheckCircle } from 'lucide-react';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { MOCK_SECTIONS, type SettingSection } from './mock-data';
import { t } from './locales';

function SystemSettings() {
  const [sections, setSections] = useState(MOCK_SECTIONS);
  const [saved, setSaved] = useState(false);

  function updateField(sectionId: string, fieldId: string, value: string | number | boolean) {
    setSections((prev) => prev.map((s) => s.id === sectionId ? { ...s, fields: s.fields.map((f) => f.id === fieldId ? { ...f, value } : f) } : s));
  }

  function handleSave() { setSaved(true); setTimeout(() => setSaved(false), 3000); }

  return (
    <ErrorBoundary fallback={<div className="wsta-settings wsta-error-state" role="alert"><p>{t('settings.error_render')}</p></div>}>
    <div className="wsta-settings" role="region" aria-label={t('settings.title')}>
      <div className="wsta-settings-header">
        <h2 className="wsta-settings-title"><Settings /><span>{t('settings.title')}</span></h2>
        <button className="btn btn-primary" onClick={handleSave} aria-label={saved ? t('settings.saved') : t('settings.save')}>
          <Save /><span>{saved ? t('settings.saved') : t('settings.save')}</span>
        </button>
      </div>

      {saved && (
        <div className="wsta-settings-toast" role="alert" aria-live="assertive">
          <CheckCircle /><span>{t('settings.saved_msg')}</span>
        </div>
      )}

      <div className="wsta-settings-sections">
        {sections.map((section: SettingSection) => (
          <div key={section.id} className="wsta-settings-section" aria-labelledby={`settings-title-${section.id}`}>
            <div className="wsta-settings-section-header">
              <section.icon aria-hidden="true" />
              <h3 id={`settings-title-${section.id}`}>{section.title}</h3>
            </div>
            <div className="wsta-settings-fields">
              {section.fields.map((field) => (
                <div key={field.id} className="wsta-settings-field">
                  <label className="wsta-settings-field-label" htmlFor={`setting-${section.id}-${field.id}`}>{field.label}</label>
                  <div className="wsta-settings-field-control">
                    {field.type === 'toggle' ? (
                      <label className="wsta-toggle-wrap">
                        <input id={`setting-${section.id}-${field.id}`} type="checkbox" checked={field.value as boolean} onChange={(e) => updateField(section.id, field.id, e.target.checked)} aria-label={field.label} />
                        <span className="wsta-toggle-slider" />
                      </label>
                    ) : field.type === 'select' ? (
                      <select className="wsta-select" id={`setting-${section.id}-${field.id}`} value={field.value as string} onChange={(e) => updateField(section.id, field.id, e.target.value)} aria-label={field.label}>
                        {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <div className="wsta-settings-input-wrap">
                        <input className="wsta-input" id={`setting-${section.id}-${field.id}`} type={field.type === 'number' ? 'number' : 'text'} value={field.value as string} onChange={(e) => updateField(section.id, field.id, field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)} placeholder={field.placeholder} aria-label={field.label} />
                        {field.type === 'number' && (field as { suffix?: string }).suffix && <span className="wsta-settings-suffix">{(field as { suffix?: string }).suffix}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default SystemSettings;
