import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSkeleton, CardSkeleton } from '../LoadingSkeleton';

describe('TableSkeleton', () => {
  it('renders with default rows and cols', () => {
    const { container } = render(<TableSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(container.querySelectorAll('.wsta-skeleton-row')).toHaveLength(5);
  });

  it('renders with custom rows', () => {
    const { container } = render(<TableSkeleton rows={3} cols={4} />);
    expect(container.querySelectorAll('.wsta-skeleton-row')).toHaveLength(3);
  });
});

describe('CardSkeleton', () => {
  it('renders with default count', () => {
    const { container } = render(<CardSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(container.querySelectorAll('.wsta-skeleton-card')).toHaveLength(6);
  });

  it('renders with custom count', () => {
    const { container } = render(<CardSkeleton count={3} />);
    expect(container.querySelectorAll('.wsta-skeleton-card')).toHaveLength(3);
  });
});
