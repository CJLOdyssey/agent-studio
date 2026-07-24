import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResourcePickerModal from '../ResourcePickerModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'workstation.noMatch': '无匹配结果',
        'workstation.confirm': '确认',
        'workstation.cancel': '取消',
        'workstation.selectedCount': '已选',
      };
      return map[key] || key;
    },
  }),
}));

const options = [
  { id: '1', name: 'Apple', desc: 'Fruit A' },
  { id: '2', name: 'Banana', desc: 'Fruit B' },
  { id: '3', name: 'Cherry', desc: 'Fruit C' },
];

describe('ResourcePickerModal', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    title: 'Pick Items',
    options,
    selectedIds: '1',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    getOptionId: (o: typeof options[0]) => o.id,
    getOptionLabel: (o: typeof options[0]) => o.name,
  };

  it('renders title and options', () => {
    render(<ResourcePickerModal {...defaultProps} />);
    expect(screen.getByText('Pick Items')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('shows selected item with check icon', () => {
    render(<ResourcePickerModal {...defaultProps} />);
    const items = screen.getByText('Apple').closest('.wsta-picker-item')!;
    expect(items).toHaveClass('selected');
  });

  it('filters options when searching', () => {
    render(<ResourcePickerModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('搜索...');
    fireEvent.change(input, { target: { value: 'Apple' } });
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
  });

  it('shows empty state when filter matches nothing', () => {
    render(<ResourcePickerModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('搜索...');
    fireEvent.change(input, { target: { value: 'XYZ' } });
    expect(screen.getByText('无匹配结果')).toBeInTheDocument();
  });

  it('handles single selection', () => {
    const onConfirm = vi.fn();
    render(<ResourcePickerModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Banana'));
    fireEvent.click(screen.getByText('确认'));
    expect(onConfirm).toHaveBeenCalledWith('2');
  });

  it('handles multiple selection', () => {
    const onConfirm = vi.fn();
    render(
      <ResourcePickerModal
        {...defaultProps}
        selectedIds={[]}
        multiple={true}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByText('Apple'));
    fireEvent.click(screen.getByText('Cherry'));
    fireEvent.click(screen.getByText('确认 (2)'));
    expect(onConfirm).toHaveBeenCalledWith(['1', '3']);
  });

  it('shows secondary info when getOptionSecondary provided', () => {
    render(
      <ResourcePickerModal
        {...defaultProps}
        getOptionSecondary={(o) => o.desc}
      />,
    );
    expect(screen.getByText('Fruit A')).toBeInTheDocument();
    expect(screen.getByText('Fruit B')).toBeInTheDocument();
    expect(screen.getByText('Fruit C')).toBeInTheDocument();
  });

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    render(<ResourcePickerModal {...defaultProps} onClose={onClose} />);
    const overlay = screen.getByText('Pick Items').closest('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on X button click', () => {
    const onClose = vi.fn();
    render(<ResourcePickerModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });
});
