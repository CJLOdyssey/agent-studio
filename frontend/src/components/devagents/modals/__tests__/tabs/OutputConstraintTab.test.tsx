import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OutputConstraintTab } from '../../tabs/OutputConstraintTab';

function renderTab(overrides?: Record<string, unknown>) {
  const props = {
    value: '',
    onChange: vi.fn(),
    onAddFromWorkstation: vi.fn(),
    ...overrides,
  };
  return { ...render(<OutputConstraintTab {...props} />), props };
}

describe('OutputConstraintTab', () => {
  it('renders textarea with placeholder', () => {
    renderTab();
    expect(screen.getByPlaceholderText('约束 Agent 的输出格式和行为...')).toBeInTheDocument();
  });

  it('displays character count', () => {
    renderTab({ value: 'test' });
    expect(screen.getByText('4 字符')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const { props } = renderTab();
    const textarea = screen.getByPlaceholderText('约束 Agent 的输出格式和行为...');
    fireEvent.change(textarea, { target: { value: 'new value' } });
    expect(props.onChange).toHaveBeenCalledWith('new value');
  });

  it('calls onAddFromWorkstation when add button clicked', () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByText('添加'));
    expect(props.onAddFromWorkstation).toHaveBeenCalled();
  });

  it('shows hint text', () => {
    renderTab();
    expect(screen.getByText('输出约束用于控制 Agent 的回复格式、长度、语言等具体要求')).toBeInTheDocument();
  });
});
