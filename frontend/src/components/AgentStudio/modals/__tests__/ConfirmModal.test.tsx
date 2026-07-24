import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'confirm.confirm') return '确认';
      if (key === 'confirm.cancel') return '取消';
      if (key === 'confirm.danger') return '危险操作';
      if (key === 'confirm.info') return '提示';
      return key;
    },
  }),
}));

import ConfirmModal from '../ConfirmModal';

describe('ConfirmModal', { tags: ['integration'] }, () => {
  it('renders with title and message', () => {
    render(
      <ConfirmModal
        title="Delete Item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders danger variant', () => {
    render(
      <ConfirmModal
        title="Delete Item"
        message="This cannot be undone"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        danger
      />,
    );
    expect(screen.getByText('危险操作')).toBeInTheDocument();
  });

  it('renders info variant by default', () => {
    render(
      <ConfirmModal
        title="Info"
        message="Just FYI"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('提示')).toBeInTheDocument();
  });

  it('renders custom confirm label', () => {
    render(
      <ConfirmModal
        title="Delete"
        message="Sure?"
        confirmLabel="Yes, delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        danger
      />,
    );
    expect(screen.getByText('Yes, delete')).toBeInTheDocument();
  });
});
