import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));
vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { sendOnEnter: true }, updateSettings: vi.fn() }),
}));
vi.mock('../GreetingAnimation', () => ({ default: () => <div data-testid="greeting-animation" /> }));
vi.mock('../../input', () => ({
  InputToolbar: vi.fn(() => <div data-testid="input-toolbar" />),
  InputToolbarHandle: {} as unknown as import('../../input').InputToolbarHandle,
}));

import HomeScreen from '../HomeScreen';
import { InputToolbar } from '../../input';
import type { ModelOption, CommandOption } from '../../../types/input';

const baseProps = {
  conversationKey: 0, models: [], selectedModel: '',
  onModelChange: vi.fn(), commands: [], onSend: vi.fn(),
  inputToolbarRef: { current: null },
};

describe('HomeScreen', { tags: ['integration'] }, () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders without crashing', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container).toBeDefined();
  });

  it('renders with running state', () => {
    const { container } = render(<HomeScreen {...baseProps} isRunning={true} onStop={vi.fn()} />);
    expect(container).toBeDefined();
  });

  it('renders the Bot logo icon', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container.querySelector('[role="img"][aria-label="AgentStudio Logo"]')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container.textContent).toContain('home.subtitle');
  });

  it('passes conversationKey to GreetingAnimation via key prop', () => {
    const { container } = render(<HomeScreen {...baseProps} conversationKey={42} />);
    expect(container.querySelector('[data-testid="greeting-animation"]')).toBeInTheDocument();
  });

  it('passes models to InputToolbar', () => {
    const models = [{ id: 'm1', name: 'GPT-4' }];
    render(<HomeScreen {...baseProps} models={models as ModelOption[]} selectedModel="m1" />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ models, selectedModel: 'm1' }),
      expect.anything(),
    );
  });

  it('passes commands to InputToolbar', () => {
    const commands = [{ id: 'cmd1', label: 'Run' }];
    render(<HomeScreen {...baseProps} commands={commands as CommandOption[]} />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ commands }),
      expect.anything(),
    );
  });

  it('passes isRunning to InputToolbar', () => {
    render(<HomeScreen {...baseProps} isRunning onStop={vi.fn()} />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ isRunning: true }),
      expect.anything(),
    );
  });

  it('passes onStop to InputToolbar when running', () => {
    const onStop = vi.fn();
    render(<HomeScreen {...baseProps} isRunning onStop={onStop} />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ onStop }),
      expect.anything(),
    );
  });

  it('passes onConfigureModels to InputToolbar', () => {
    const onConfig = vi.fn();
    render(<HomeScreen {...baseProps} onConfigureModels={onConfig} />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ onConfigureModels: onConfig }),
      expect.anything(),
    );
  });

  it('passes onExecuteCommand to InputToolbar', () => {
    const onExec = vi.fn();
    render(<HomeScreen {...baseProps} onExecuteCommand={onExec} />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ onExecuteCommand: onExec }),
      expect.anything(),
    );
  });

  it('renders the home-centered layout', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container.querySelector('[role="img"][aria-label="AgentStudio Logo"]')).toBeInTheDocument();
  });

  it('renders the home-hero section', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container.textContent).toContain('home.subtitle');
  });
});
