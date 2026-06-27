import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolsTab } from '../../tabs/ToolsTab';
import { TestProviders } from '../../../../../test/setup';
import type { ToolFormData } from '../../../workstation/tool/tool.types';

const defaultFormData: ToolFormData = {
  name: '', description: '', category: '自定义工具', model: 'GPT-4o',
  status: 'active', version: 'v1.0.0', endpoint: '', parameters: '{"type":"object"}',
};

const baseItems = [
  { id: '1', name: 'weather_query', description: 'Query weather', enabled: true },
  { id: '2', name: 'web_search', description: 'Search web', enabled: false },
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
  return { ...render(<TestProviders><ToolsTab {...props} /></TestProviders>), props };
}

describe('ToolsTab', () => {
  it('renders tool list with items', () => {
    renderTab();
    expect(screen.getByText('weather_query')).toBeInTheDocument();
    expect(screen.getByText('web_search')).toBeInTheDocument();
  });

  it('shows correct tool count', () => {
    renderTab();
    expect(screen.getByText('工具 (2)')).toBeInTheDocument();
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
    expect(screen.getByText('暂无工具')).toBeInTheDocument();
  });

  it('opens three-dot menu with rename and delete options', () => {
    renderTab();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    expect(screen.getByText('重命名')).toBeInTheDocument();
    expect(screen.getByText('删除')).toBeInTheDocument();
  });

  it('shows edit option when onEditFull is provided', () => {
    const onEditFull = vi.fn();
    renderTab({ onEditFull });
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('calls onRemove when delete clicked in menu', () => {
    const { props } = renderTab();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    fireEvent.click(screen.getByText('删除'));
    expect(props.onRemove).toHaveBeenCalledWith('1');
  });

  it('renders ToolFormModal when showForm is true', () => {
    renderTab({ showForm: true });
    expect(screen.getByText('New Tool')).toBeInTheDocument();
  });
});
