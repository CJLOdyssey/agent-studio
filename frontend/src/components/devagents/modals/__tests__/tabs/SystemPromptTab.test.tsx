import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SystemPromptTab } from '../../tabs/SystemPromptTab';

function renderTab(overrides?: Record<string, unknown>) {
  const props = {
    value: '',
    onChange: vi.fn(),
    onAddFromWorkstation: vi.fn(),
    ...overrides,
  };
  return { ...render(<SystemPromptTab {...props} />), props };
}

describe('SystemPromptTab', () => {
  it('renders textarea with placeholder', () => {
    renderTab();
    expect(screen.getByPlaceholderText('定义该 Agent 的角色、职责和行为规则...')).toBeInTheDocument();
  });

  it('displays character count', () => {
    renderTab({ value: 'hello' });
    expect(screen.getByText('5 字符')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const { props } = renderTab();
    const textarea = screen.getByPlaceholderText('定义该 Agent 的角色、职责和行为规则...');
    fireEvent.change(textarea, { target: { value: 'test' } });
    expect(props.onChange).toHaveBeenCalledWith('test');
  });

  it('calls onAddFromWorkstation when add button clicked', () => {
    const { props } = renderTab();
    fireEvent.click(screen.getByText('添加'));
    expect(props.onAddFromWorkstation).toHaveBeenCalled();
  });

  it('shows hint text', () => {
    renderTab();
    expect(screen.getByText('系统提示词定义了 Agent 的核心身份和行为准则')).toBeInTheDocument();
  });
});
