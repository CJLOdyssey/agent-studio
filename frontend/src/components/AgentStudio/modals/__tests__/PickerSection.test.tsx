import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PickerSection from '../PickerSection';

vi.mock('../PickerModal', () => ({
  default: ({ title, items, onSelect, onClose }: { title: string; items: unknown[]; onSelect: () => void; onClose: () => void }) => (
    <div data-testid="picker-modal">
      <span>{title}</span>
      <span>items: {items.length}</span>
      <button onClick={onSelect}>select</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

describe('PickerSection', () => {
  const items = {
    system: [{ id: '1', name: 'System Prompt', category: 'system' as const, content: 'test' }],
  };

  it('renders PickerModal when tab is provided', () => {
    render(<PickerSection tab="system" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('picker-modal')).toBeInTheDocument();
    expect(screen.getByText(/从工作台添加/)).toBeInTheDocument();
  });

  it('returns null when tab is null', () => {
    const { container } = render(<PickerSection tab={null} items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
