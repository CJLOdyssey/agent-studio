import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormTextarea from '../FormTextarea';

describe('FormTextarea', { tags: ['unit'] }, () => {
  it('renders label and textarea', () => {
    render(<FormTextarea label="Description" value="" onChange={vi.fn()} />);
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders required indicator', () => {
    render(<FormTextarea label="Description" value="" onChange={vi.fn()} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<FormTextarea label="Description" value="" onChange={vi.fn()} error="Too long" />);
    expect(screen.getByText('Too long')).toBeInTheDocument();
  });

  it('shows character count when maxLength is set', () => {
    render(<FormTextarea label="Description" value="abc" onChange={vi.fn()} maxLength={100} />);
    expect(screen.getByText('3/100')).toBeInTheDocument();
  });

  it('renders required indicator and error simultaneously', () => {
    render(<FormTextarea label="Name" value="" onChange={vi.fn()} required error="Field is required" />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });
});
