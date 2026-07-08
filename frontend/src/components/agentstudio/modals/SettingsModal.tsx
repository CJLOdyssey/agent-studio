import { useState, useRef, useEffect } from 'react';
import { Globe, Save, Code, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../contexts/SettingsContext';
import { changeLanguage } from '../../../i18n/index';
import Modal from '../../shared/Modal';
import ToggleSwitch from '../../shared/ToggleSwitch';

interface Props {
  onClose: () => void;
}

type SettingsTab = 'general' | 'editor' | 'shortcuts';

const shortcuts = [
  { keys: 'Ctrl/Cmd + N', descKey: 'shortcuts.newChat' },
  { keys: 'Ctrl/Cmd + ,', descKey: 'shortcuts.settings' },
  { keys: 'Enter', descKey: 'shortcuts.send' },
  { keys: 'Shift + Enter', descKey: 'shortcuts.newline' },
  { keys: 'Escape', descKey: 'shortcuts.close' },
  { keys: 'Ctrl/Cmd + Z', descKey: 'shortcuts.undo' },
  { keys: 'Ctrl/Cmd + S', descKey: 'shortcuts.save' },
];

export default function SettingsModal({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const rangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rangeRef.current) {
      const pct = ((settings.fontSize - 12) / 4) * 100;
      rangeRef.current.style.setProperty('--pct', pct + '%');
    }
  }, [settings.fontSize]);

  return (
    <Modal
      title={t('settings.title')}
      onClose={onClose}
      className="settings-modal"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            <Save size={14} />
            {t('settings.save')}
          </button>
        </>
      }
    >
      <div className="settings-body">
        <div className="settings-sidebar">
          {(
            [
              ['general', Globe],
              ['editor', Code],
              ['shortcuts', Keyboard],
            ] as const
          ).map(([tab, Icon]) => (
            <button
              key={tab}
              className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab as SettingsTab)}
            >
              <Icon size={16} />
              <span>{t('settings.' + tab)}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h4>{t('settings.general')}</h4>

              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.language')}</label>
                  <span className="settings-item-desc">{t('settings.languageDesc')}</span>
                </div>
                <select
                  className="settings-select"
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.timezone')}</label>
                  <span className="settings-item-desc">{t('settings.timezoneDesc')}</span>
                </div>
                <select
                  className="settings-select"
                  value={settings.timezone}
                  onChange={(e) => updateSettings({ timezone: e.target.value })}
                >
                  <option value="Asia/Shanghai">Asia/Shanghai (UTC+8)</option>
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="Europe/London">Europe/London (UTC+0)</option>
                </select>
              </div>

              <div className="settings-divider"></div>
              <h4>{t('settings.appearance')}</h4>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.theme')}</label>
                  <span className="settings-item-desc">{t('settings.themeDesc')}</span>
                </div>
                <select
                  className="settings-select"
                  value={settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as any })}
                >
                  <option value="dark">{t('settings.dark')}</option>
                  <option value="light">{t('settings.light')}</option>
                  <option value="system">{t('settings.system')}</option>
                </select>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.fontSize')}</label>
                  <span className="settings-item-desc">{t('settings.fontSizeDesc')}</span>
                </div>
                <div className="settings-range-wrapper">
                  <input
                    ref={rangeRef}
                    type="range"
                    min="12"
                    max="16"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                    className="settings-range"
                  />
                  <span className="settings-range-value">{settings.fontSize}px</span>
                </div>
              </div>

              <div className="settings-divider"></div>
              <h4>AI Chat</h4>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.sendMode')}</label>
                  <span className="settings-item-desc">{t('settings.sendModeDesc')}</span>
                </div>
                <select
                  className="settings-select"
                  value={settings.sendMode}
                  onChange={(e) => updateSettings({ sendMode: e.target.value as any })}
                >
                  <option value="enter">{t('settings.enterSend')}</option>
                  <option value="ctrlEnter">Ctrl + Enter</option>
                </select>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.autoSave')}</label>
                  <span className="settings-item-desc">{t('settings.autoSaveDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.autoSave} onChange={(v) => updateSettings({ autoSave: v })} />
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.autoComplete')}</label>
                  <span className="settings-item-desc">{t('settings.autoCompleteDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.autoComplete} onChange={(v) => updateSettings({ autoComplete: v })} />
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.streamOutput')}</label>
                  <span className="settings-item-desc">{t('settings.streamOutputDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.streamOutput} onChange={(v) => updateSettings({ streamOutput: v })} />
              </div>

              <div className="settings-divider"></div>
              <h4>{t('settings.notificationTitle')}</h4>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.sound')}</label>
                  <span className="settings-item-desc">{t('settings.soundDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
              </div>
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="settings-section">
              <h4>{t('settings.editor')}</h4>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.editorFontSize')}</label>
                  <span className="settings-item-desc">{t('settings.editorFontSizeDesc')}</span>
                </div>
                <select
                  className="settings-select"
                  value={settings.editorFontSize}
                  onChange={(e) => updateSettings({ editorFontSize: Number(e.target.value) })}
                >
                  {[12, 13, 14, 15, 16, 18, 20].map((s) => (
                    <option key={s} value={s}>
                      {s}px
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.tabSize')}</label>
                  <span className="settings-item-desc">{t('settings.tabSizeDesc')}</span>
                </div>
                <select
                  className="settings-select"
                  value={settings.tabSize}
                  onChange={(e) => updateSettings({ tabSize: Number(e.target.value) })}
                >
                  {[2, 4, 8].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.wordWrap')}</label>
                  <span className="settings-item-desc">{t('settings.wordWrapDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.wordWrap} onChange={(v) => updateSettings({ wordWrap: v })} />
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.lineNumber')}</label>
                  <span className="settings-item-desc">{t('settings.lineNumberDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.lineNumber} onChange={(v) => updateSettings({ lineNumber: v })} />
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="settings-section">
              <h4>{t('settings.shortcuts')}</h4>
              <p className="settings-item-desc" style={{ marginBottom: 16 }}>
                {t('settings.shortcutsDesc')}
              </p>
              {shortcuts.map((s) => (
                <div key={s.keys} className="settings-item">
                  <span style={{ fontSize: 'var(--da-font-size-sm)', color: 'var(--da-text-primary)' }}>
                    {t(s.descKey)}
                  </span>
                  <kbd className="shortcut-key">{s.keys}</kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
