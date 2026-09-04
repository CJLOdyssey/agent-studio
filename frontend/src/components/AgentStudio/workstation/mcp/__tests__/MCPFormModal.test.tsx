import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../locales', () => ({ t: (k: string) => k }));

import MCPFormModal from '../MCPFormModal';
import type { MCPFormData } from '../mcp.types';

const baseFormData: MCPFormData = {
  name: '', description: '', type: 'stdio', enabled: true, status: 'disconnected', version: 'v1.0.0', command: '', url: '', args: [], env: [],
};

function renderModal(overrides?: Record<string, unknown>) {
  const props = {
    editingItem: null,
    formData: baseFormData,
    setFormData: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    errors: [] as string[],
    ...overrides,
  };
  return { ...render(<MCPFormModal {...props} />), props };
}

describe('MCPFormModal', { tags: ['unit'] }, () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders create title when editingItem is null', () => {
    renderModal();
    expect(screen.getByText('mcp.form_title_new')).toBeInTheDocument();
  });

  it('renders edit title when editingItem is provided', () => {
    renderModal({ editingItem: { id: 'm1', ...baseFormData, createdAt: '2026-01-01' } });
    expect(screen.getByText('mcp.form_title_edit')).toBeInTheDocument();
  });

  it('shows validation errors', () => {
    renderModal({ errors: ['Name is required', 'Version must be semver'] });
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Version must be semver')).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', async () => {
    const { props } = renderModal();
    await userEvent.click(screen.getByText('mcp.form_save_create'));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('mcp.form_cancel'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls setFormData when name input changes', async () => {
    const { props } = renderModal({ formData: { ...baseFormData, name: '' } });
    const input = screen.getByPlaceholderText('mcp.form_name_placeholder');
    await userEvent.type(input, 'test');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('renders all form field labels', () => {
    renderModal();
    expect(screen.getByText('mcp.form_name')).toBeInTheDocument();
    expect(screen.getByText('mcp.form_desc')).toBeInTheDocument();
    expect(screen.getByText('mcp.form_type')).toBeInTheDocument();
    expect(screen.getByText('mcp.form_enabled')).toBeInTheDocument();
    expect(screen.getByText('mcp.form_version')).toBeInTheDocument();
  });

  it('renders command input for stdio type', () => {
    renderModal();
    expect(screen.getByPlaceholderText('mcp.form_command_placeholder')).toBeInTheDocument();
  });

  it('renders url input for sse type', () => {
    renderModal({ formData: { ...baseFormData, type: 'sse' } });
    expect(screen.getByPlaceholderText('mcp.form_url_placeholder')).toBeInTheDocument();
  });

  it('calls setFormData on description change', async () => {
    const { props } = renderModal();
    const textarea = screen.getByPlaceholderText('mcp.form_desc_placeholder');
    await userEvent.type(textarea, 'desc');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on version input change', async () => {
    const { props } = renderModal();
    const input = screen.getByPlaceholderText('mcp.form_version_placeholder');
    await userEvent.type(input, '2');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls onClose when X button clicked', () => {
    const { props } = renderModal();
    const closeBtn = document.querySelector('.fixed.inset-0 button[aria-label]') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay clicked', () => {
    const { props } = renderModal();
    const overlay = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when modal content clicked', () => {
    const { props } = renderModal();
    const modal = document.querySelector('.fixed.inset-0 > div') as HTMLElement;
    fireEvent.click(modal);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows edit mode save button text', () => {
    renderModal({ editingItem: { id: 'm1', ...baseFormData, createdAt: '2026-01-01' } });
    expect(screen.getByText('mcp.form_save_edit')).toBeInTheDocument();
  });

  it('switches from url to command input when type changed to stdio', () => {
    const { props } = renderModal({ formData: { ...baseFormData, type: 'sse' } });
    expect(screen.getByPlaceholderText('mcp.form_url_placeholder')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'stdio' } });
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls setFormData when enabled toggle changes', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('enabled toggle defaults to checked when enabled is undefined', () => {
    renderModal({ formData: { ...baseFormData, enabled: undefined } });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('calls setFormData when version input changes', () => {
    const { props } = renderModal();
    const input = screen.getByPlaceholderText('mcp.form_version_placeholder');
    fireEvent.change(input, { target: { value: 'v2.0.0' } });
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('renders url input for sse and command input for stdio', () => {
    renderModal({ formData: { ...baseFormData, type: 'sse' } });
    expect(screen.getByPlaceholderText('mcp.form_url_placeholder')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('mcp.form_command_placeholder')).not.toBeInTheDocument();
  });
});
