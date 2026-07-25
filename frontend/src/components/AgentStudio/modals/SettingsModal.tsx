import { useState } from 'react';
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
  const fontPct = ((settings.fontSize - 12) / 4) * 100;

  return (
    <Modal
      title={t('settings.title')}
      onClose={onClose}
      className="w-[970px] h-[600px] flex flex-col overflow-hidden"
      footer={
        <>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={onClose}>
            {t('settings.save')}
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 overflow-hidden">
        <div className="w-[160px] px-4 py-5 flex flex-col gap-1 overflow-hidden min-h-0">
          {(
            [
              ['general', Globe],
              ['about', Info],
            ] as const
          ).map(([tab, Icon]) => (
            <button
              key={tab}
              className={`flex items-center gap-3 p-2 px-3 bg-transparent border-none rounded-md text-[var(--color-text-secondary)] text-sm cursor-pointer transition-[background,color] duration-150 text-left hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab as SettingsTab)}
            >
              <Icon size={16} />
              <span>{t('settings.' + tab)}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 px-6 py-5 overflow-y-auto min-h-0">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h4>{t('settings.general')}</h4>

              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <label>{t('settings.language')}</label>
                  <span className="text-xs text-[var(--color-text-muted)]">{t('settings.languageDesc')}</span>
                </div>
                <select
                  className="p-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm min-w-[140px] cursor-pointer focus:border-[var(--color-accent)]"
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </div>

              <div className="h-px bg-[var(--color-border)] my-5"></div>
              <h4>{t('settings.appearance')}</h4>
              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <label>{t('settings.theme')}</label>
                  <span className="text-xs text-[var(--color-text-muted)]">{t('settings.themeDesc')}</span>
                </div>
                <select
                  className="p-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm min-w-[140px] cursor-pointer focus:border-[var(--color-accent)]"
                  value={settings.theme}
                  onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' | 'system' })}
                >
                  <option value="dark">{t('settings.dark')}</option>
                  <option value="light">{t('settings.light')}</option>
                  <option value="system">{t('settings.system')}</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <label>{t('settings.fontSize')}</label>
                  <span className="text-xs text-[var(--color-text-muted)]">{t('settings.fontSizeDesc')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="12"
                    max="16"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                    style={{
                      background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${fontPct}%, var(--color-surface-hover) ${fontPct}%, var(--color-surface-hover) 100%)`,
                    }}
                    className="w-[120px] h-[6px] rounded-[3px] appearance-none cursor-pointer
                      focus-visible:outline-none
                      [&::-webkit-slider-runnable-track]:appearance-none [&::-webkit-slider-runnable-track]:h-[6px] [&::-webkit-slider-runnable-track]:bg-transparent
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-accent)] [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:[box-shadow:0_1px_4px_rgba(0,0,0,0.3)]
                      focus-visible:[&::-webkit-slider-thumb]:[box-shadow:0_0_0_2px_var(--color-accent),0_1px_4px_rgba(0,0,0,0.3)]
                      [&::-moz-range-track]:h-[6px] [&::-moz-range-track]:rounded-[3px] [&::-moz-range-track]:border-none [&::-moz-range-track]:bg-[var(--color-surface-hover)]
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[var(--color-accent)] [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:cursor-pointer
                      focus-visible:[&::-moz-range-thumb]:[box-shadow:0_0_0_2px_var(--color-accent)]
                      [&::-moz-range-progress]:h-[6px] [&::-moz-range-progress]:rounded-[3px] [&::-moz-range-progress]:bg-[var(--color-accent)]"
                  />
                  <span className="text-sm font-semibold text-[var(--color-text-secondary)] min-w-[32px] text-right">{settings.fontSize}px</span>
                </div>
              </div>

              <div className="h-px bg-[var(--color-border)] my-5"></div>
              <h4>AI Chat</h4>
              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <label>{t('settings.sendMode')}</label>
                  <span className="text-xs text-[var(--color-text-muted)]">{t('settings.sendModeDesc')}</span>
                </div>
                <select
                  className="p-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm min-w-[140px] cursor-pointer focus:border-[var(--color-accent)]"
                  value={settings.sendMode}
                  onChange={(e) => updateSettings({ sendMode: e.target.value as 'enter' | 'ctrl-enter' })}
                >
                  <option value="enter">{t('settings.enterSend')}</option>
                  <option value="ctrl-enter">Ctrl + Enter</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <label>{t('settings.autoSave')}</label>
                  <span className="text-xs text-[var(--color-text-muted)]">{t('settings.autoSaveDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.autoSave} onChange={(v) => updateSettings({ autoSave: v })} />
              </div>
              <div className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <label>{t('settings.streamOutput')}</label>
                  <span className="text-xs text-[var(--color-text-muted)]">{t('settings.streamOutputDesc')}</span>
                </div>
                <ToggleSwitch checked={settings.streamOutput} onChange={(v) => updateSettings({ streamOutput: v })} />
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <h4>{t('settings.about')}</h4>
              <div className="flex items-center justify-between py-4" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0, padding: 0, border: 'none' }}>

                {/* App identity */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '24px 20px', width: '100%',
                  background: 'color-mix(in srgb, var(--color-surface), var(--color-text-primary) 3%)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10, marginBottom: 16,
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 40%, transparent), color-mix(in srgb, var(--color-accent) 10%, transparent))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-accent)', flexShrink: 0,
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--color-accent) 20%, transparent)',
                  }}>
                    <Info size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 650, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                      AgentStudio
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 4,
                        background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                        color: 'var(--color-accent)',
                        fontSize: 11, fontWeight: 500,
                      }}>
                        v {VERSION}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {BUILD_TIME}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
                  width: '100%', background: 'var(--color-border)',
                  border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden',
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
                      background: 'var(--color-surface-raised)',
                      fontSize: 'var(--da-font-size-sm)',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{row.label}</span>
                      {row.link ? (
                        <a href={row.link} target="_blank" rel="noopener noreferrer"
                          style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                          {row.value} ↗
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-primary)', fontWeight: 450 }}>{row.value}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Footer note */}
                <div style={{
                  width: '100%', marginTop: 16,
                  fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center',
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
