import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FormSelect from '../FormSelect';

describe('FormSelect', { tags: ['unit'] }, () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
  ];

  it('renders label and options', () => {
    render(<FormSelect label="Select me" value="" onChange={vi.fn()} options={options} />);
    expect(screen.getByText('Select me')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('renders placeholder when provided', () => {
    render(<FormSelect label="Test" value="" onChange={vi.fn()} options={options} placeholder="Choose..." />);
    expect(screen.getByText('Choose...')).toBeInTheDocument();
  });

  it('shows required asterisk', () => {
    render(<FormSelect label="Required" value="" onChange={vi.fn()} options={options} required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<FormSelect label="Test" value="" onChange={vi.fn()} options={options} error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });
});
