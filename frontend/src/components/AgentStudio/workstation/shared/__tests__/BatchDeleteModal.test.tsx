import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'workstation.batchDelete': 'Batch Delete',
        'workstation.cancel': 'Cancel',
        'workstation.confirmDelete': 'Delete',
      };
      return map[key] || key;
    },
  }),
}));

import BatchDeleteModal from '../BatchDeleteModal';

describe('BatchDeleteModal', { tags: ['unit'] }, () => {
  it('renders with count and label', () => {
    render(<BatchDeleteModal count={3} label="Agent" onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Batch Delete')).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button clicked', () => {
    const onConfirm = vi.fn();
    render(<BatchDeleteModal count={1} onConfirm={onConfirm} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<BatchDeleteModal count={1} onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
