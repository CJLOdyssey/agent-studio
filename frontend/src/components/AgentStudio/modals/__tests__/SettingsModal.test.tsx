import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'settings.title': 'Settings',
          'settings.cancel': 'Cancel',
          'settings.save': 'Save',
          'settings.general': 'General',
          'settings.about': 'About',
          'settings.language': 'Language',
          'settings.languageDesc': 'Choose language',
          'settings.theme': 'Theme',
          'settings.themeDesc': 'Choose theme',
          'settings.dark': 'Dark',
          'settings.light': 'Light',
          'settings.system': 'System',
          'settings.fontSize': 'Font Size',
          'settings.fontSizeDesc': 'Adjust font size',
          'settings.sendMode': 'Send Mode',
          'settings.sendModeDesc': 'How to send messages',
          'settings.enterSend': 'Enter',
          'settings.autoSave': 'Auto Save',
          'settings.autoSaveDesc': 'Auto save',
          'settings.streamOutput': 'Stream Output',
          'settings.streamOutputDesc': 'Stream responses',
          'settings.appearance': 'Appearance',
        };
        return map[key] || key;
      },
      i18n: { language: 'zh-CN' },
    }),
  };
});

vi.mock('../../../i18n/index', () => ({
  changeLanguage: vi.fn(),
}));

vi.mock('../../../contexts/SettingsContext', () => {
  let settings = { theme: 'dark' as const, fontSize: 14, sendMode: 'enter' as const, autoSave: true, streamOutput: true };
  return {
    useSettings: () => ({
      settings,
      updateSettings: (updates: Partial<typeof settings>) => {
        settings = { ...settings, ...updates };
      },
    }),
  };
});

vi.mock('../../shared/Modal', () => ({
  default: ({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) => (
    <div data-testid="modal">
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-content">{children}</div>
      <div data-testid="modal-footer">{footer}</div>
      <button onClick={onClose} data-testid="modal-close">close</button>
    </div>
  ),
}));

vi.mock('../../shared/ToggleSwitch', () => ({
  default: ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button data-testid={`toggle-${checked}`} onClick={() => onChange(!checked)}>
      {checked ? 'ON' : 'OFF'}
    </button>
  ),
}));

import SettingsModal from '../SettingsModal';

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with settings title', () => {
    render(
      <TestProviders>
        <SettingsModal onClose={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders general tab by default', () => {
    render(
      <TestProviders>
        <SettingsModal onClose={vi.fn()} />
      </TestProviders>,
    );
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('switches to about tab', () => {
    render(
      <TestProviders>
        <SettingsModal onClose={vi.fn()} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByText('About'));
    expect(screen.getByText('AgentStudio')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <TestProviders>
        <SettingsModal onClose={onClose} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when save is clicked', () => {
    const onClose = vi.fn();
    render(
      <TestProviders>
        <SettingsModal onClose={onClose} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders about tab with version info', () => {
    render(
      <TestProviders>
        <SettingsModal onClose={vi.fn()} />
      </TestProviders>,
    );
    fireEvent.click(screen.getByText('About'));
    expect(screen.getByText(/v 1\.0\.0/)).toBeInTheDocument();
  });
});
