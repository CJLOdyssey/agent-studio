import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemPromptTab } from '../SystemPromptTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe('SystemPromptTab', () => {
  it('renders textarea with value', () => {
    render(<SystemPromptTab value="hello" onChange={() => {}} onAddFromWorkstation={() => {}} />);
    expect(screen.getByDisplayValue('hello')).toBeDefined();
  });

  it('calls onChange when textarea changes', () => {
    const onChange = vi.fn();
    render(<SystemPromptTab value="" onChange={onChange} onAddFromWorkstation={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new' } });
    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('calls onAddFromWorkstation when button clicked', () => {
    const onAdd = vi.fn();
    render(<SystemPromptTab value="" onChange={() => {}} onAddFromWorkstation={onAdd} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('displays char count', () => {
    render(<SystemPromptTab value="test" onChange={() => {}} onAddFromWorkstation={() => {}} />);
    expect(screen.getByText('4 workstation.chars')).toBeDefined();
  });
});
