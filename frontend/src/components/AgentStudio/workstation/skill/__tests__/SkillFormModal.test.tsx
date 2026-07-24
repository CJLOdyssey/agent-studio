import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../locales', () => ({ t: (key: string) => key }));
vi.mock('../../../../api/hooks', () => ({ useAvailableModels: () => [] }));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import SkillFormModal from '../SkillFormModal';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

const baseFormData = {
  name: '', description: '', category: 'AI/ML', status: 'available' as const,
  version: 'v1.0.0', author: '', instructions: '', prompt_id: '',
  tool_names: [] as string[], output_constraint: '',
};

const baseProps = {
  editingSkill: null as Record<string, unknown> | null,
  formData: baseFormData,
  setFormData: vi.fn(),
  onSave: vi.fn(),
  onClose: vi.fn(),
  errors: [] as string[],
};

describe('SkillFormModal', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create mode title', () => {
    render(<SkillFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('skill.form_title_new')).toBeInTheDocument();
  });

  it('renders edit mode title when editingSkill is provided', () => {
    render(
      <SkillFormModal
        {...baseProps}
        editingSkill={{ id: 's1', name: 'Test Skill' } as any}
      />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('skill.form_title_edit')).toBeInTheDocument();
  });

  it('renders all form field labels', () => {
    render(<SkillFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('skill.form_name')).toBeInTheDocument();
    expect(screen.getByText('skill.form_desc')).toBeInTheDocument();
    expect(screen.getByText('skill.form_category')).toBeInTheDocument();
    expect(screen.getByText('skill.form_status')).toBeInTheDocument();
    expect(screen.getByText('skill.form_version')).toBeInTheDocument();
    expect(screen.getByText('skill.form_author')).toBeInTheDocument();
    expect(screen.getByText('skill.form_prompt')).toBeInTheDocument();
    expect(screen.getByText('skill.form_tools')).toBeInTheDocument();
    expect(screen.getByText('skill.form_output_constraint')).toBeInTheDocument();
    expect(screen.getByText('skill.form_instructions')).toBeInTheDocument();
  });

  it('shows validation errors', () => {
    render(
      <SkillFormModal {...baseProps} errors={['Name is required', 'Invalid version']} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Invalid version')).toBeInTheDocument();
  });

  it('calls setFormData on name input change', () => {
    const setFormData = vi.fn();
    render(<SkillFormModal {...baseProps} setFormData={setFormData} />, { wrapper: Wrapper });
    const input = screen.getByPlaceholderText('skill.form_name_placeholder');
    fireEvent.change(input, { target: { value: 'My Skill' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on description change', () => {
    const setFormData = vi.fn();
    render(<SkillFormModal {...baseProps} setFormData={setFormData} />, { wrapper: Wrapper });
    const textarea = screen.getByPlaceholderText('skill.form_desc_placeholder');
    fireEvent.change(textarea, { target: { value: 'A skill description' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on version input change', () => {
    const setFormData = vi.fn();
    render(<SkillFormModal {...baseProps} setFormData={setFormData} />, { wrapper: Wrapper });
    const input = screen.getByPlaceholderText('skill.form_version_placeholder');
    fireEvent.change(input, { target: { value: 'v2.0.0' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls onSave when save button clicked', () => {
    const onSave = vi.fn();
    render(<SkillFormModal {...baseProps} onSave={onSave} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('skill.form_save_create'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<SkillFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('skill.form_cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<SkillFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const closeBtn = document.querySelector('.modal-close') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    render(<SkillFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when modal content clicked', () => {
    const onClose = vi.fn();
    render(<SkillFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const modal = document.querySelector('.wsta-modal') as HTMLElement;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<SkillFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows edit mode save button text', () => {
    render(
      <SkillFormModal {...baseProps} editingSkill={{ id: 's1' } as any} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('skill.form_save_edit')).toBeInTheDocument();
  });

  it('shows create mode save button text', () => {
    render(<SkillFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('skill.form_save_create')).toBeInTheDocument();
  });
});
