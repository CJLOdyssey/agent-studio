import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemPromptTab } from '../../tabs/SystemPromptTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderTab(overrides?: Record<string, unknown>) {
  const props = {
    value: '',
    onChange: vi.fn(),
    onAddFromWorkstation: vi.fn(),
    ...overrides,
  };
  return { ...render(<SystemPromptTab {...props} />), props };
}

describe('SystemPromptTab', { tags: ['integration'] }, () => {
  it('renders textarea with placeholder', () => {
    renderTab();
    expect(screen.getByPlaceholderText('workstation.systemPromptDesc')).toBeInTheDocument();
  });

  it('displays character count', () => {
    renderTab({ value: 'hello' });
    expect(screen.getByText((c) => c.includes('workstation.chars'))).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const { props } = renderTab();
    const textarea = screen.getByPlaceholderText('workstation.systemPromptDesc');
    fireEvent.change(textarea, { target: { value: 'test' } });
    expect(props.onChange).toHaveBeenCalledWith('test');
  });

  it('calls onAddFromWorkstation when add button clicked', () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByText('workstation.add'));
    expect(props.onAddFromWorkstation).toHaveBeenCalled();
  });

  it('shows hint text', () => {
    renderTab();
    expect(screen.getByText('workstation.systemPromptDesc')).toBeInTheDocument();
  });
});
