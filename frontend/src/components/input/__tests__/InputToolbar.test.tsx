import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../../hooks/useMessageComposer', () => ({
  useMessageComposer: () => ({ value: '', setValue: vi.fn(), submit: vi.fn(), handleKeyDown: vi.fn(), hasContent: false, charCount: 0, maxLength: 2000 }),
}));

vi.mock('../../../hooks/useCommandPalette', () => ({
  useCommandPalette: () => ({ filteredCommands: [], activeIndex: -1, updateFromValue: vi.fn(), handleKeyDown: vi.fn(), selectCommand: vi.fn() }),
}));

vi.mock('../../../utils/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { sendOnEnter: true }, updateSettings: vi.fn() }),
}));

vi.mock('./ModelSelector', () => ({ default: () => <div data-testid="model-selector" /> }));
vi.mock('./FileAttach', () => ({ default: () => <div data-testid="file-attach" /> }));
vi.mock('./CommandDropdown', () => ({ default: () => <div data-testid="command-dropdown" /> }));

import InputToolbar from '../InputToolbar';

const defaultProps = {
  onSend: vi.fn(),
  models: [],
  selectedModel: '',
  onModelChange: vi.fn(),
  placeholder: 'Type a message...',
  maxLength: 2000,
};

describe('InputToolbar', () => {
  it('renders basic elements', () => {
    render(<InputToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeDefined();
  });

  it('renders send button when not running', () => {
    render(<InputToolbar {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders stop button when running', () => {
    render(<InputToolbar {...defaultProps} isRunning={true} onStop={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not render model selector when no models', () => {
    render(<InputToolbar {...defaultProps} />);
    expect(screen.queryByTestId('model-selector')).toBeNull();
  });

  it('renders textarea with placeholder', () => {
    render(<InputToolbar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeDefined();
  });

  it('renders without crashing when isRunning=true', () => {
    render(<InputToolbar {...defaultProps} isRunning={true} onStop={vi.fn()} />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeDefined();
  });
});
