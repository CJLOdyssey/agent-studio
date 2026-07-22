import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PickerModal from '../PickerModal';

const items = [
  { id: '1', name: 'Alpha Tool', description: 'First tool' },
  { id: '2', name: 'Beta Service', description: 'Second service' },
  { id: '3', name: 'Gamma API', description: 'Third API', source: 'Built-in' },
];

describe('PickerModal', () => {
  it('renders title and all items', () => {
    render(<PickerModal title="Select Item" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Select Item')).toBeInTheDocument();
    expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
    expect(screen.getByText('Beta Service')).toBeInTheDocument();
    expect(screen.getByText('Gamma API')).toBeInTheDocument();
  });

  it('calls onSelect when an item is clicked', () => {
    const onSelect = vi.fn();
    render(<PickerModal title="Select" items={items} onSelect={onSelect} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Alpha Tool'));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={onClose} />);
    const overlay = document.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('filters items by search query', () => {
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText('搜索...');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
    expect(screen.queryByText('Beta Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma API')).not.toBeInTheDocument();
  });

  it('shows empty message when no items match', () => {
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText('搜索...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('无匹配结果')).toBeInTheDocument();
  });

  it('shows source badge when source is provided', () => {
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Built-in')).toBeInTheDocument();
  });

  it('shows empty state when no items and no query', () => {
    render(<PickerModal title="Select" items={[]} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('暂无可用条目，请先在工作台中创建')).toBeInTheDocument();
  });

  it('search is case-insensitive', () => {
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText('搜索...');
    fireEvent.change(searchInput, { target: { value: 'alpha' } });
    expect(screen.getByText('Alpha Tool')).toBeInTheDocument();
  });

  it('searches in description too', () => {
    render(<PickerModal title="Select" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText('搜索...');
    fireEvent.change(searchInput, { target: { value: 'Second' } });
    expect(screen.getByText('Beta Service')).toBeInTheDocument();
  });
});
