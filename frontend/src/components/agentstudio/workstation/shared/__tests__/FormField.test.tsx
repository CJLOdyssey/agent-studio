import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormField from '../FormField';

describe('FormField', () => {
  it('renders label and input', () => {
    render(<FormField label="Name" value="" onChange={vi.fn()} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders required indicator', () => {
    render(<FormField label="Name" value="" onChange={vi.fn()} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<FormField label="Name" value="" onChange={vi.fn()} error="Required field" />);
    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('renders placeholder', () => {
    render(<FormField label="Name" value="" onChange={vi.fn()} placeholder="Enter name" />);
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });

  it('renders with value', () => {
    render(<FormField label="Name" value="John" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
  });
});
