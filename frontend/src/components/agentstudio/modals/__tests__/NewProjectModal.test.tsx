import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'sidebar.newChat': 'New Chat',
        'newProject.subtitle': 'Start a new conversation',
        'newProject.confirmCreate': 'Create',
        'newProject.message': 'A new project will be created.',
        'confirm.cancel': 'Cancel',
      };
      return map[key] || key;
    },
  }),
}));

import NewProjectModal from '../NewProjectModal';

describe('NewProjectModal', () => {
  it('renders modal with title and buttons', () => {
    render(<NewProjectModal onClose={vi.fn()} onCreateProject={vi.fn()} />);
    expect(screen.getByText('New Chat')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('calls onCreateProject and onClose when Create clicked', () => {
    const onClose = vi.fn();
    const onCreateProject = vi.fn();
    render(<NewProjectModal onClose={onClose} onCreateProject={onCreateProject} />);
    fireEvent.click(screen.getByText('Create'));
    expect(onCreateProject).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel clicked', () => {
    const onClose = vi.fn();
    render(<NewProjectModal onClose={onClose} onCreateProject={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
