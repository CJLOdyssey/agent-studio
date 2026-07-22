import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MCPFormModal from '../MCPFormModal';
import type { MCPFormData } from '../mcp.types';

const baseFormData: MCPFormData = {
  name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: '', url: '',
};

function renderModal(overrides?: Partial<Parameters<typeof renderModal>[0]>) {
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

describe('MCPFormModal', () => {
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
});
