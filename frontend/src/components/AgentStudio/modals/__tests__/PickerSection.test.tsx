import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PickerSection from '../PickerSection';

vi.mock('../../workstation/shared/ResourcePickerModal', () => ({
  default: ({ title, options, onConfirm, onClose }: { title: string; options: unknown[]; onConfirm: () => void; onClose: () => void }) => (
    <div data-testid="resource-picker-modal">
      <span>{title}</span>
      <span>options: {options.length}</span>
      <button onClick={onConfirm}>confirm</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

describe('PickerSection', { tags: ['integration'] }, () => {
  const items = {
    system: [{ id: '1', name: 'System Prompt', category: 'system' as const, content: 'test' }],
  };

  it('renders ResourcePickerModal when tab is provided', () => {
    render(<PickerSection tab="system" items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByTestId('resource-picker-modal')).toBeInTheDocument();
    expect(screen.getByText(/从工作台添加/)).toBeInTheDocument();
  });

  it('returns null when tab is null', () => {
    const { container } = render(<PickerSection tab={null} items={items} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
