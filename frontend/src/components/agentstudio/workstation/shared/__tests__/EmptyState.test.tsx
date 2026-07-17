import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileCode } from 'lucide-react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState icon={<FileCode size={24} />} title="No items" description="Add some items to get started" />,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Add some items to get started')).toBeInTheDocument();
  });

  it('renders without description', () => {
    render(<EmptyState icon={<FileCode size={24} />} title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('renders action element', () => {
    render(
      <EmptyState
        icon={<FileCode size={24} />}
        title="No data"
        action={<button>Create</button>}
      />,
    );
    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});
