import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders icon and title', () => {
    render(<EmptyState icon={<span data-testid="icon">X</span>} title="No items found" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState icon={<span>X</span>} title="Empty" description="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    const { container } = render(<EmptyState icon={<span>X</span>} title="Empty" />);
    expect(container.querySelector('.empty-state-desc-sm')).toBeNull();
  });
});
