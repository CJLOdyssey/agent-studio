import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WstaPagination from '../WstaPagination';

describe('WstaPagination', { tags: ['unit'] }, () => {
  it('renders total count', () => {
    render(<WstaPagination total={100} current={1} pageSize={10} onChange={vi.fn()} />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('renders with different current page', () => {
    render(<WstaPagination total={50} current={2} pageSize={10} onChange={vi.fn()} />);
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});
