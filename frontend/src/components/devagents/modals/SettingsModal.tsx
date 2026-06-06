import { useState, useRef, useEffect } from 'react';
import { User, Globe, Bell, Save, Code, Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../contexts/SettingsContext';
import { changeLanguage } from '../../../i18n/index';
import Modal from '../../shared/Modal';
import ToggleSwitch from '../../shared/ToggleSwitch';

interface Props {
  onClose: () => void;
}

type SettingsTab = 'general' | 'editor' | 'shortcuts' | 'account' | 'notifications';

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

  const [username, setUsername] = useState('User 1001');
  const [email, setEmail] = useState('user@example.com');
  const [messageNotif, setMessageNotif] = useState(true);
  const [taskNotif, setTaskNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);

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
              ['account', User],
              ['notifications', Bell],
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
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="settings-select"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.theme')}</label>
                  <span className="settings-item-desc">{t('settings.themeDesc')}</span>
                </div>
                <select
                  value={settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' | 'system' })}
                  className="settings-select"
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
                  <span className="settings-range-label">12</span>
                  <input
                    ref={rangeRef}
                    type="range"
                    min={12}
                    max={16}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                    onInput={(e) => {
                      e.currentTarget.style.setProperty('--pct', ((+e.currentTarget.value - 12) / 4) * 100 + '%');
                    }}
                    className="settings-range"
                  />
                  <span className="settings-range-label">16</span>
                  <span className="settings-range-value">{settings.fontSize}px</span>
                </div>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.sendMode')}</label>
                  <span className="settings-item-desc">{t('settings.sendModeDesc')}</span>
                </div>
                <select
                  value={settings.sendMode}
                  onChange={(e) => updateSettings({ sendMode: e.target.value as 'enter' | 'ctrl-enter' })}
                  className="settings-select"
                >
                  <option value="enter">{t('settings.enter')}</option>
                  <option value="ctrl-enter">{t('settings.ctrlEnter')}</option>
                </select>
              </div>
              <div className="settings-divider"></div>
              <h4>{t('settings.aiChat')}</h4>
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
                  value={settings.editorFontSize}
                  onChange={(e) => updateSettings({ editorFontSize: Number(e.target.value) })}
                  className="settings-select"
                >
                  {[11, 12, 13, 14, 15, 16, 18, 20].map((v) => (
                    <option key={v} value={v}>
                      {v}px
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
                  value={settings.tabSize}
                  onChange={(e) => updateSettings({ tabSize: Number(e.target.value) })}
                  className="settings-select"
                >
                  <option value="2">{t('settings.tab2')}</option>
                  <option value="4">{t('settings.tab4')}</option>
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

          {activeTab === 'account' && (
            <div className="settings-section">
              <h4>{t('settings.profile')}</h4>
              <div className="settings-profile">
                <div className="settings-avatar">
                  <User size={32} />
                </div>
                <div className="settings-profile-info">
                  <span className="settings-profile-name">{username}</span>
                  <span className="settings-profile-role">{t('settings.userRole')}</span>
                </div>
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.username')}</label>
                  <span className="settings-item-desc">{t('settings.usernameDesc')}</span>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="settings-input"
                />
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.email')}</label>
                  <span className="settings-item-desc">{t('settings.emailDesc')}</span>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="settings-input"
                />
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.changePassword')}</label>
                  <span className="settings-item-desc">{t('settings.changePasswordDesc')}</span>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => {}}>
                  {t('settings.changePassword')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h4>{t('settings.notificationTitle')}</h4>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.sound')}</label>
                  <span className="settings-item-desc">{t('settings.soundDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
              </div>
              <div className="settings-divider"></div>
              <h4>{t('settings.messageNotif')}</h4>
              {[
                {
                  label: t('settings.newMessage'),
                  desc: t('settings.newMessageDesc'),
                  val: messageNotif,
                  set: setMessageNotif,
                },
                {
                  label: t('settings.taskReminder'),
                  desc: t('settings.taskReminderDesc'),
                  val: taskNotif,
                  set: setTaskNotif,
                },
                { label: t('settings.mention'), desc: t('settings.mentionDesc'), val: true, set: () => {} },
              ].map(({ label, desc, val, set }) => (
                <div className="settings-item" key={label}>
                  <div className="settings-item-info">
                    <label>{label}</label>
                    <span className="settings-item-desc">{desc}</span>
                  </div>
                  <ToggleSwitch checked={val} onChange={set} />
                </div>
              ))}
              <div className="settings-divider"></div>
              <h4>{t('settings.emailNotif')}</h4>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.emailNotif')}</label>
                  <span className="settings-item-desc">{t('settings.emailNotifDesc')}</span>
                </div>
                <ToggleSwitch checked={emailNotif} onChange={setEmailNotif} />
              </div>
              <div className="settings-item">
                <div className="settings-item-info">
                  <label>{t('settings.digestFreq')}</label>
                  <span className="settings-item-desc">{t('settings.digestFreqDesc')}</span>
                </div>
                <select value={'daily'} onChange={() => {}} className="settings-select">
                  <option value="never">{t('settings.never')}</option>
                  <option value="daily">{t('settings.daily')}</option>
                  <option value="weekly">{t('settings.weekly')}</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
