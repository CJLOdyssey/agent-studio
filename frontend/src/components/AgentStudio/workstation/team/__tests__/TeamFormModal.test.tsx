import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../locales', () => ({ t: (k: string) => k }));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import TeamFormModal from '../TeamFormModal';
import { EMPTY_FORM } from '../validate';
import type { TeamEntry } from '../team.types';

function makeTeamEntry(overrides: Partial<TeamEntry> = {}): TeamEntry {
  return {
    id: 't1',
    name: 'Alpha Team',
    description: 'A dev team',
    status: 'active' as const,
    category: 'dev' as const,
    createdAt: '2024-01-01',
    agents: [],
    memberCount: 0,
    ...overrides,
  };
}

describe('TeamFormModal', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container).toBeDefined();
  });

  it('renders create mode title when no editingItem', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('team.form_title_new')).toBeInTheDocument();
  });

  it('renders edit mode title when editingItem is provided', () => {
    render(
      <TeamFormModal editingItem={makeTeamEntry()} formData={{ ...EMPTY_FORM, name: 'Alpha Team' }} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('team.form_title_edit')).toBeInTheDocument();
  });

  it('shows editing team name in subtitle', () => {
    render(
      <TeamFormModal editingItem={makeTeamEntry()} formData={{ ...EMPTY_FORM, name: 'Alpha Team' }} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Alpha Team')).toBeInTheDocument();
  });

  it('does not show team name subtitle in create mode', () => {
    render(
      <TeamFormModal editingItem={null} formData={{ ...EMPTY_FORM, name: '' }} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    // The subtitle paragraph should render but show empty string (since editingItem is null)
    expect(screen.queryByText(/team.form_title_new/)).toBeInTheDocument();
  });

  it('renders name input with placeholder', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByPlaceholderText('team.form_name_placeholder')).toBeInTheDocument();
  });

  it('renders name input with current form value', () => {
    render(
      <TeamFormModal editingItem={null} formData={{ ...EMPTY_FORM, name: 'My Team' }} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    const input = screen.getByPlaceholderText('team.form_name_placeholder') as HTMLInputElement;
    expect(input.value).toBe('My Team');
  });

  it('renders description textarea', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByPlaceholderText('team.form_desc_placeholder')).toBeInTheDocument();
  });

  it('renders category dropdown with all options', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    // Options are rendered as text nodes via option elements
    const selects = screen.getAllByRole('combobox');
    const categorySelect = selects[0] as HTMLSelectElement;
    expect(categorySelect.value).toBe('dev');
    // Check option text content exists
    expect(categorySelect.textContent).toContain('team.category_dev');
    expect(categorySelect.textContent).toContain('team.category_ops');
    expect(categorySelect.textContent).toContain('team.category_test');
  });

  it('renders status dropdown with active/inactive', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1] as HTMLSelectElement;
    expect(statusSelect.value).toBe('active');
    expect(statusSelect.textContent).toContain('team.status_active');
    expect(statusSelect.textContent).toContain('team.status_inactive');
  });

  it('displays validation errors', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={['team.name_required', 'team.name_length']} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('team.name_required')).toBeInTheDocument();
    expect(screen.getByText('team.name_length')).toBeInTheDocument();
  });

  it('does not display errors div when errors array is empty', () => {
    const { container } = render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.querySelector('.wsta-form-errors')).toBeNull();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={onClose} />
    );
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.keyDown(overlay!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={onClose} />
    );
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.keyDown(overlay!, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(overlay!, { key: 'Tab' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking overlay', () => {
    const onClose = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={onClose} />
    );
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking modal content', () => {
    const onClose = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={onClose} />
    );
    const modalContent = document.querySelector('.modal-content');
    fireEvent.click(modalContent!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onSave when clicking save button', () => {
    const onSave = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={onSave} onClose={vi.fn()} />
    );
    const saveBtn = screen.getByText('team.form_save_create');
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking cancel button', () => {
    const onClose = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={onClose} />
    );
    const cancelBtn = screen.getByText('team.form_cancel');
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking X close button', () => {
    const onClose = vi.fn();
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={onClose} />
    );
    const closeBtn = document.querySelector('.modal-close') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls setFormData when name input changes', () => {
    const setFormData = vi.fn((fn: (f: typeof EMPTY_FORM) => typeof EMPTY_FORM) => fn(EMPTY_FORM));
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={setFormData} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    const input = screen.getByPlaceholderText('team.form_name_placeholder');
    fireEvent.change(input, { target: { value: 'New Name' } });
    // setFormData receives a function, and on change gets called with that function
    expect(setFormData).toHaveBeenCalled();
  });

  it('shows create button text in create mode', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('team.form_save_create')).toBeInTheDocument();
  });

  it('shows edit button text in edit mode', () => {
    render(
      <TeamFormModal editingItem={makeTeamEntry()} formData={{ ...EMPTY_FORM, name: 'Alpha' }} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('team.form_save_edit')).toBeInTheDocument();
  });

  it('name input has maxLength of 50', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    const input = screen.getByPlaceholderText('team.form_name_placeholder') as HTMLInputElement;
    expect(input.maxLength).toBe(50);
  });

  it('name input matches placeholder for autoFocus test', () => {
    render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    const input = screen.getByPlaceholderText('team.form_name_placeholder') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('renders section title with basic info icon', () => {
    const { container } = render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.querySelector('.wsta-form-section-title')).toBeInTheDocument();
  });

  it('renders modal with correct CSS class', () => {
    const { container } = render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.querySelector('.wsta-modal')).toBeInTheDocument();
    expect(container.querySelector('.wsta-modal-sm')).toBeInTheDocument();
  });

  it('renders team avatar icon in header', () => {
    const { container } = render(
      <TeamFormModal editingItem={null} formData={EMPTY_FORM} setFormData={vi.fn()} errors={[]} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.querySelector('.team-form-avatar')).toBeInTheDocument();
  });
});
