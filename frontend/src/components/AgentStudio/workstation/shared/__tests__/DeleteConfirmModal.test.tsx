import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'workstation.confirmDelete': 'Confirm Delete',
        'workstation.cancel': 'Cancel',
      };
      return map[key] || key;
    },
  }),
}));

import DeleteConfirmModal from '../DeleteConfirmModal';

describe('DeleteConfirmModal', { tags: ['unit'] }, () => {
  it('renders with name and label', () => {
    render(<DeleteConfirmModal name="Test Item" label="Project" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Confirm Delete' })).toBeInTheDocument();
    expect(screen.getByText(/Test Item/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button clicked', () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirmModal name="Item" onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<DeleteConfirmModal name="Item" onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
