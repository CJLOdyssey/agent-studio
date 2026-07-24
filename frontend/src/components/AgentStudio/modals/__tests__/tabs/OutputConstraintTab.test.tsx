import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutputConstraintTab } from '../../tabs/OutputConstraintTab';

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
  return { ...render(<OutputConstraintTab {...props} />), props };
}

describe('OutputConstraintTab', { tags: ['integration'] }, () => {
  it('renders textarea with placeholder', () => {
    renderTab();
    expect(screen.getByPlaceholderText('workstation.outputConstraintDesc')).toBeInTheDocument();
  });

  it('displays character count', () => {
    renderTab({ value: 'test' });
    expect(screen.getByText((c) => c.includes('workstation.chars'))).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const { props } = renderTab();
    const textarea = screen.getByPlaceholderText('workstation.outputConstraintDesc');
    fireEvent.change(textarea, { target: { value: 'new value' } });
    expect(props.onChange).toHaveBeenCalledWith('new value');
  });

  it('calls onAddFromWorkstation when add button clicked', () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByText('workstation.add'));
    expect(props.onAddFromWorkstation).toHaveBeenCalled();
  });

  it('shows hint text', () => {
    renderTab();
    expect(screen.getByText('workstation.outputConstraintDesc')).toBeInTheDocument();
  });
});
