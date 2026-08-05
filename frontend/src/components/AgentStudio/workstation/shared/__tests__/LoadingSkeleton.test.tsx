import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TableSkeleton, CardSkeleton } from '../LoadingSkeleton';

describe('TableSkeleton', { tags: ['unit'] }, () => {
  it('renders with default rows and cols', () => {
    render(<TableSkeleton />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl.childElementCount).toBe(5);
  });

  it('renders with custom rows', () => {
    render(<TableSkeleton rows={3} cols={4} />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.childElementCount).toBe(3);
  });
});

describe('CardSkeleton', { tags: ['unit'] }, () => {
  it('renders with default count', () => {
    render(<CardSkeleton />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl.childElementCount).toBe(6);
  });

  it('renders with custom count', () => {
    render(<CardSkeleton count={3} />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.childElementCount).toBe(3);
  });
});
