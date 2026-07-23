import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));
vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { sendOnEnter: true }, updateSettings: vi.fn() }),
}));
vi.mock('./GreetingAnimation', () => ({ default: () => null }));
vi.mock('../input', () => ({
  InputToolbar: () => null,
  InputToolbarHandle: {} as any,
}));

import HomeScreen from '../HomeScreen';

const baseProps = {
  conversationKey: 0, models: [], selectedModel: '',
  onModelChange: vi.fn(), commands: [], onSend: vi.fn(),
  inputToolbarRef: { current: null } as any,
};

describe('HomeScreen', () => {
  it('renders without crashing', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container).toBeDefined();
  });

  it('renders with running state', () => {
    const { container } = render(<HomeScreen {...baseProps} isRunning={true} onStop={vi.fn()} />);
    expect(container).toBeDefined();
  });
});
