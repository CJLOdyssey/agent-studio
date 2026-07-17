import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToggleSwitch from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  it('renders checkbox with checked state', () => {
    render(<ToggleSwitch checked={true} onChange={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders checkbox with unchecked state', () => {
    render(<ToggleSwitch checked={false} onChange={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('calls onChange when toggled', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders with sm size', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} size="sm" />);
    expect(container.querySelector('.toggle-switch.sm')).toBeInTheDocument();
  });

  it('renders with md size by default', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} />);
    expect(container.querySelector('.toggle-switch.md')).toBeInTheDocument();
  });
});
