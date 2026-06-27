import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigItemList from '../ConfigItemList';

const baseItems = [
  { id: '1', name: 'Tool A', description: 'Desc A', enabled: true },
  { id: '2', name: 'Tool B', description: 'Desc B', enabled: false },
];

function renderList(overrides?: Record<string, unknown>) {
  const props = {
    title: 'Tools',
    items: baseItems,
    presets: [],
    editingId: null,
    emptyLabel: 'No items',
    onToggle: vi.fn(),
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onStartEdit: vi.fn(),
    onFinishEdit: vi.fn(),
    ...overrides,
  };
  return { ...render(<ConfigItemList {...props} />), props };
}

describe('ConfigItemList', () => {
  it('renders all items with names', () => {
    renderList();
    expect(screen.getByText('Tool A')).toBeInTheDocument();
    expect(screen.getByText('Tool B')).toBeInTheDocument();
  });

  it('shows item count in header', () => {
    renderList();
    expect(screen.getByText('Tools (2)')).toBeInTheDocument();
  });

  it('calls onToggle when checkbox clicked', () => {
    const { props } = renderList();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[0]);
    expect(props.onToggle).toHaveBeenCalledWith('1');
  });

  it('shows empty label when no items', () => {
    renderList({ items: [], presets: [] });
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('hides header when hideHeader is true', () => {
    renderList({ hideHeader: true });
    expect(screen.queryByText('Tools (2)')).not.toBeInTheDocument();
  });

  it('opens three-dot menu and shows rename option', async () => {
    renderList();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    expect(screen.getByText('重命名')).toBeInTheDocument();
  });

  it('calls onStartEdit when rename clicked', () => {
    const { props } = renderList();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    fireEvent.click(screen.getByText('重命名'));
    expect(props.onStartEdit).toHaveBeenCalledWith('1');
  });

  it('calls onRemove when delete clicked', () => {
    const { props } = renderList();
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    fireEvent.click(screen.getByText('删除'));
    expect(props.onRemove).toHaveBeenCalledWith('1');
  });

  it('shows edit option when onEditFull provided', () => {
    const onEditFull = vi.fn();
    renderList({ onEditFull });
    const actionBtns = document.querySelectorAll('.agent-config-item-action');
    fireEvent.click(actionBtns[0]);
    expect(screen.getByText('编辑')).toBeInTheDocument();
  });

  it('calls onAdd when add button clicked', () => {
    const { props } = renderList();
    fireEvent.click(screen.getByText('添加'));
    expect(props.onAdd).toHaveBeenCalled();
  });
});
