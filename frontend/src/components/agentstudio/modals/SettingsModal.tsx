import { useState, useRef, useEffect } from 'react';
import { Globe, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../contexts/SettingsContext';
import { changeLanguage } from '../../../i18n/index';
import Modal from '../../shared/Modal';
import ToggleSwitch from '../../shared/ToggleSwitch';

interface Props {
  onClose: () => void;
}

type SettingsTab = 'general' | 'about';

const VERSION = '1.0.0';
const BUILD_TIME = '2026-05-08';

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
              ['about', Info],
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
                  <label>{t('settings.streamOutput')}</label>
                  <span className="settings-item-desc">{t('settings.streamOutputDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.streamOutput} onChange={(v) => updateSettings({ streamOutput: v })} />
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <h4>{t('settings.about')}</h4>
              <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0, padding: 0, border: 'none' }}>

                {/* App identity */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '24px 20px', width: '100%',
                  background: 'color-mix(in srgb, var(--da-bg-primary), var(--da-text-primary) 3%)',
                  border: '1px solid var(--da-border-subtle)',
                  borderRadius: 10, marginBottom: 16,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--da-accent-indigo) 40%, transparent), color-mix(in srgb, var(--da-accent-indigo) 10%, transparent))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--da-accent-indigo)', flexShrink: 0,
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--da-accent-indigo) 20%, transparent)',
                  }}>
                    <Info size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--da-text-primary)', letterSpacing: '-0.02em' }}>
                      AgentStudio
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 4,
                        background: 'color-mix(in srgb, var(--da-accent-indigo) 12%, transparent)',
                        color: 'var(--da-accent-indigo)',
                        fontSize: 11, fontWeight: 500,
                      }}>
                        v {VERSION}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--da-text-muted)' }}>
                        {BUILD_TIME}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
                  width: '100%', background: 'var(--da-border-subtle)',
                  border: '1px solid var(--da-border-subtle)', borderRadius: 10, overflow: 'hidden',
                }}>
                  {[
                    { label: 'Version', value: VERSION },
                    { label: 'Build', value: BUILD_TIME },
                    { label: 'Frontend', value: 'React 18 + Vite 6' },
                    { label: 'Backend', value: 'FastAPI + Python 3.12' },
                    { label: 'License', value: 'MIT' },
                    { label: 'Repository', value: 'GitHub', link: 'https://github.com/CJLOdyssey/virtual-software-team' },
                  ].map((row) => (
                    <div key={row.label} style={{
                      padding: '12px 16px',
                      background: 'var(--da-bg-surface)',
                      fontSize: 'var(--da-font-size-sm)',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      <span style={{ color: 'var(--da-text-muted)', fontSize: 11 }}>{row.label}</span>
                      {row.link ? (
                        <a href={row.link} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--da-accent-indigo)', textDecoration: 'none', fontWeight: 500 }}>
                          {row.value} ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--da-text-primary)', fontWeight: 450 }}>{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer note */}
                <div style={{
                  width: '100%', marginTop: 16,
                  fontSize: 11, color: 'var(--da-text-muted)', textAlign: 'center',
                  lineHeight: 1.6, opacity: 0.7,
                }}>
                  AI Agent 协作系统 — 基于 LangGraph 多智能体编排
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
