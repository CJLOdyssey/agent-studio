import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'workstation.close': 'Close',
        'workstation.cancel': 'Cancel',
        'workstation.save': 'Save',
        'workstation.delete': 'Delete',
      };
      return map[key] || key;
    },
  }),
}));

import CreateModal from '../CreateModal';

describe('CreateModal', { tags: ['unit'] }, () => {
  it('renders with title and children', () => {
    render(<CreateModal title="Test Modal" onClose={vi.fn()} onSave={vi.fn()}><p>content</p></CreateModal>);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', () => {
    const onSave = vi.fn();
    render(<CreateModal title="Modal" onClose={vi.fn()} onSave={onSave}><p>content</p></CreateModal>);
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<CreateModal title="Modal" onClose={onClose} onSave={vi.fn()}><p>content</p></CreateModal>);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows errors when provided', () => {
    render(<CreateModal title="Modal" onClose={vi.fn()} onSave={vi.fn()} errors={['Error 1', 'Error 2']}><p>content</p></CreateModal>);
    expect(screen.getByText('Error 1')).toBeInTheDocument();
    expect(screen.getByText('Error 2')).toBeInTheDocument();
  });

  it('shows delete button when isEdit and onDelete provided', () => {
    render(<CreateModal title="Modal" onClose={vi.fn()} onSave={vi.fn()} isEdit onDelete={vi.fn()}><p>content</p></CreateModal>);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('renders with custom save label', () => {
    render(<CreateModal title="Modal" onClose={vi.fn()} onSave={vi.fn()} saveLabel="Create Now"><p>content</p></CreateModal>);
    expect(screen.getByText('Create Now')).toBeInTheDocument();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<CreateModal title="Modal" onClose={onClose} onSave={vi.fn()}><p>content</p></CreateModal>);
    fireEvent.keyDown(document.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on non-Escape key', () => {
    const onClose = vi.fn();
    render(<CreateModal title="Modal" onClose={onClose} onSave={vi.fn()}><p>content</p></CreateModal>);
    fireEvent.keyDown(document.querySelector('.modal-overlay')!, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders with large class when large prop set', () => {
    render(<CreateModal title="Modal" onClose={vi.fn()} onSave={vi.fn()} large><p>content</p></CreateModal>);
    expect(document.querySelector('.wsta-modal-lg')).toBeInTheDocument();
  });

  it('does not render delete button when isEdit is false', () => {
    render(<CreateModal title="Modal" onClose={vi.fn()} onSave={vi.fn()}><p>content</p></CreateModal>);
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders with aria-modal role', () => {
    render(<CreateModal title="Modal Dialog" onClose={vi.fn()} onSave={vi.fn()}><p>content</p></CreateModal>);
    expect(screen.getByRole('dialog', { name: 'Modal Dialog' })).toBeInTheDocument();
  });
});
