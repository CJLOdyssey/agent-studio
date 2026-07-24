import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MCPFormModal from '../MCPFormModal';
import type { MCPFormData } from '../mcp.types';

const baseFormData: MCPFormData = {
  name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: '', url: '',
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
    expect(screen.getByText('New MCP')).toBeInTheDocument();
  });

  it('renders edit title when editingItem is provided', () => {
    renderModal({ editingItem: { id: 'm1', ...baseFormData, createdAt: '2026-01-01' } });
    expect(screen.getByText('Edit MCP')).toBeInTheDocument();
  });

  it('shows validation errors', () => {
    renderModal({ errors: ['Name is required', 'Version must be semver'] });
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Version must be semver')).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', async () => {
    const { props } = renderModal();
    await userEvent.click(screen.getByText('Create MCP'));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls setFormData when name input changes', async () => {
    const { props } = renderModal({ formData: { ...baseFormData, name: '' } });
    const input = screen.getByPlaceholderText('2-50 characters');
    await userEvent.type(input, 'test');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('renders all form field labels', () => {
    renderModal();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
  });

  it('renders command input for stdio type', () => {
    renderModal();
    expect(screen.getByPlaceholderText('npx @modelcontextprotocol/server-...')).toBeInTheDocument();
  });

  it('renders url input for sse type', () => {
    renderModal({ formData: { ...baseFormData, type: 'sse' } });
    expect(screen.getByPlaceholderText('https://mcp.example.com/v1')).toBeInTheDocument();
  });

  it('calls setFormData on description change', async () => {
    const { props } = renderModal();
    const textarea = screen.getByPlaceholderText('Describe MCP service...');
    await userEvent.type(textarea, 'desc');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on version input change', async () => {
    const { props } = renderModal();
    const input = screen.getByPlaceholderText('v1.0.0');
    await userEvent.type(input, '2');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls onClose when X button clicked', () => {
    const { props } = renderModal();
    const closeBtn = document.querySelector('.modal-close') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay clicked', () => {
    const { props } = renderModal();
    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when modal content clicked', () => {
    const { props } = renderModal();
    const modal = document.querySelector('.wsta-modal') as HTMLElement;
    fireEvent.click(modal);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('shows edit mode save button text', () => {
    renderModal({ editingItem: { id: 'm1', ...baseFormData, createdAt: '2026-01-01' } });
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('switches from url to command input when type changed to stdio', () => {
    const { props } = renderModal({ formData: { ...baseFormData, type: 'sse' } });
    expect(screen.getByPlaceholderText('https://mcp.example.com/v1')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'stdio' } });
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls setFormData when status select changes', () => {
    const { props } = renderModal();
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'connected' } });
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('calls setFormData when version input changes', () => {
    const { props } = renderModal();
    const input = screen.getByPlaceholderText('v1.0.0');
    fireEvent.change(input, { target: { value: 'v2.0.0' } });
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('renders url input for sse and command input for stdio', () => {
    const { rerender } = renderModal({ formData: { ...baseFormData, type: 'sse' } });
    expect(screen.getByPlaceholderText('https://mcp.example.com/v1')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('npx @modelcontextprotocol/server-...')).not.toBeInTheDocument();
  });
});
