import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutputConstraintTab } from '../OutputConstraintTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('OutputConstraintTab', () => {
  it('renders textarea with value', () => {
    render(<OutputConstraintTab value="constraints" onChange={() => {}} onAddFromWorkstation={() => {}} />);
    expect(screen.getByDisplayValue('constraints')).toBeDefined();
  });

  it('calls onChange when textarea changes', () => {
    const onChange = vi.fn();
    render(<OutputConstraintTab value="" onChange={onChange} onAddFromWorkstation={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    expect(onChange).toHaveBeenCalledWith('new');
  });
});
