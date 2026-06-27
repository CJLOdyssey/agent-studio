import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface Settings {
  theme: Theme;
  fontSize: number;
  sendMode: 'enter' | 'ctrl-enter';
  autoSave: boolean;
  autoComplete: boolean;
  soundEnabled: boolean;
  streamOutput: boolean;
  editorFontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumber: boolean;
  timezone: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  theme: 'dark',
  fontSize: 14,
  sendMode: 'enter',
  autoSave: true,
  autoComplete: true,
  soundEnabled: true,
  streamOutput: true,
  editorFontSize: 13,
  tabSize: 2,
  wordWrap: true,
  lineNumber: true,
  timezone: 'Asia/Shanghai',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function playBeep() {
  try {
    const AudioCtor =
      window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtor!();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch {}
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('devagents-settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem('devagents-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    document.documentElement.style.setProperty('--da-font-size-base', `${settings.fontSize}px`);
  }, [settings.fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    const setThemeClass = (theme: Theme) => {
      root.classList.remove('dark');
      if (theme === 'dark') root.classList.add('dark');
      else if (theme === 'system') {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
      }
    };
    const applyTheme = () => {
      if (document.startViewTransition) {
        document.startViewTransition(() => setThemeClass(settings.theme));
      } else {
        setThemeClass(settings.theme);
      }
    };
    applyTheme();

    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => setThemeClass('system');
      mq.addEventListener('change', onChange);
      return () => {
        mq.removeEventListener('change', onChange);
      };
    }
  }, [settings.theme]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  return <SettingsContext.Provider value={{ settings, updateSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

export function useNotificationSound() {
  const { settings } = useSettings();
  return useCallback(() => {
    if (settings.soundEnabled) playBeep();
  }, [settings.soundEnabled]);
}
