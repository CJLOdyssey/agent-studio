import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function ThrowError({ message }: { message: string }) {
  throw new Error(message);
}

describe('ErrorBoundary', { tags: ['unit'] }, () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders fallback UI when error occurs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowError message="Test error" />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('renders custom fallback when provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError message="Boom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('calls onError callback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError message="Boom" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    vi.restoreAllMocks();
  });
});
