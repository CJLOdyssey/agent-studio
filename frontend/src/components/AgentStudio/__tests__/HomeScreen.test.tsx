import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));
vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { sendOnEnter: true }, updateSettings: vi.fn() }),
}));
vi.mock('../GreetingAnimation', () => ({ default: () => <div data-testid="greeting-animation" /> }));
vi.mock('../../input', () => ({
  InputToolbar: vi.fn(() => <div data-testid="input-toolbar" />),
  InputToolbarHandle: {} as any,
}));

import HomeScreen from '../HomeScreen';
import { InputToolbar } from '../../input';

const baseProps = {
  conversationKey: 0, models: [], selectedModel: '',
  onModelChange: vi.fn(), commands: [], onSend: vi.fn(),
  inputToolbarRef: { current: null } as any,
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
    expect(container.querySelector('.agentstudio-home-logo-icon')).toBeInTheDocument();
  });

  it('renders subtitle text', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container.textContent).toContain('home.subtitle');
  });

  it('passes conversationKey to GreetingAnimation via key prop', () => {
    const { container } = render(<HomeScreen {...baseProps} conversationKey={42} />);
    expect(container.querySelector('[data-testid="greeting-animation"]')).toBeInTheDocument();
  });

  it('renders all five feature buttons', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    const btns = container.querySelectorAll('.agentstudio-feature-btn');
    expect(btns.length).toBe(5);
  });

  it('calls onExecuteCommand with "search" when search button clicked', async () => {
    const onExec = vi.fn();
    render(<HomeScreen {...baseProps} onExecuteCommand={onExec} />);
    const searchBtn = screen.getByText('features.search');
    await userEvent.click(searchBtn);
    expect(onExec).toHaveBeenCalledWith('search');
  });

  it('calls onExecuteCommand with "data" when data button clicked', async () => {
    const onExec = vi.fn();
    render(<HomeScreen {...baseProps} onExecuteCommand={onExec} />);
    const dataBtn = screen.getByText('features.data');
    await userEvent.click(dataBtn);
    expect(onExec).toHaveBeenCalledWith('data');
  });

  it('calls onExecuteCommand with "document" when document button clicked', async () => {
    const onExec = vi.fn();
    render(<HomeScreen {...baseProps} onExecuteCommand={onExec} />);
    const docBtn = screen.getByText('features.document');
    await userEvent.click(docBtn);
    expect(onExec).toHaveBeenCalledWith('document');
  });

  it('calls onExecuteCommand with "image" when image button clicked', async () => {
    const onExec = vi.fn();
    render(<HomeScreen {...baseProps} onExecuteCommand={onExec} />);
    const imgBtn = screen.getByText('features.image');
    await userEvent.click(imgBtn);
    expect(onExec).toHaveBeenCalledWith('image');
  });

  it('calls onExecuteCommand with "more" when more button clicked', async () => {
    const onExec = vi.fn();
    render(<HomeScreen {...baseProps} onExecuteCommand={onExec} />);
    const moreBtn = screen.getByText('features.more');
    await userEvent.click(moreBtn);
    expect(onExec).toHaveBeenCalledWith('more');
  });

  it('does not throw when feature button clicked without onExecuteCommand', async () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    const btns = container.querySelectorAll('.agentstudio-feature-btn');
    await userEvent.click(btns[0] as HTMLElement);
    // should not crash
  });

  it('passes models to InputToolbar', () => {
    const models = [{ id: 'm1', name: 'GPT-4' }];
    render(<HomeScreen {...baseProps} models={models as any} selectedModel="m1" />);
    expect(InputToolbar).toHaveBeenCalledWith(
      expect.objectContaining({ models, selectedModel: 'm1' }),
      expect.anything(),
    );
  });

  it('passes commands to InputToolbar', () => {
    const commands = [{ id: 'cmd1', label: 'Run' }];
    render(<HomeScreen {...baseProps} commands={commands as any} />);
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
    expect(container.querySelector('.agentstudio-home-centered')).toBeInTheDocument();
  });

  it('renders the home-hero section', () => {
    const { container } = render(<HomeScreen {...baseProps} />);
    expect(container.querySelector('.agentstudio-home-hero')).toBeInTheDocument();
  });
});
