import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MCPTab } from '../../tabs/MCPTab';
import type { MCPFormData } from '../../../workstation/mcp/mcp.types';

const defaultFormData: MCPFormData = {
  name: '', description: '', type: 'stdio', status: 'disconnected',
  version: 'v1.0.0', command: '', url: '',
};

const baseItems = [
  { id: '1', name: 'mcp-server', description: 'MCP Server', enabled: true },
];

function renderTab(overrides?: Record<string, unknown>) {
  const props = {
    items: baseItems,
    editingId: null,
    showForm: false,
    formData: defaultFormData,
    formErrors: [],
    editingItem: null,
    onToggle: vi.fn(),
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onStartEdit: vi.fn(),
    onFinishEdit: vi.fn(),
    onPickerOpen: vi.fn(),
    onCustomize: vi.fn(),
    onFormSave: vi.fn(),
    onFormClose: vi.fn(),
    setFormData: vi.fn(),
    ...overrides,
  };
  return { ...render(<MCPTab {...props} />), props };
}

describe('MCPTab', () => {
  it('renders MCP list with items', () => {
    renderTab();
    expect(screen.getByText('mcp-server')).toBeInTheDocument();
  });

  it('shows correct MCP count', () => {
    renderTab();
    expect(screen.getByText('MCP (1)')).toBeInTheDocument();
  });

  it('calls onToggle when checkbox clicked', () => {
    const { props } = renderTab();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    expect(props.onToggle).toHaveBeenCalledWith('1');
  });

  it('calls onCustomize when customize button clicked', () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByText('自定义'));
    expect(props.onCustomize).toHaveBeenCalled();
  });

  it('calls onPickerOpen when add button clicked', () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByText('添加'));
    expect(props.onPickerOpen).toHaveBeenCalled();
  });

  it('shows empty state when no items', () => {
    renderTab({ items: [] });
    expect(screen.getByText('暂无 MCP')).toBeInTheDocument();
  });

  it('opens three-dot menu with delete option', () => {
    renderTab();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('calls onRemove when delete clicked', () => {
    const { props } = renderTab();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    fireEvent.click(screen.getByText('删除'));
    expect(props.onRemove).toHaveBeenCalledWith('1');
  });
});
