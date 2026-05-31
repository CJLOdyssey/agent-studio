import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../legacy/ChatInput';

describe('ChatInput', () => {
  it('渲染占位符文本', () => {
    render(<ChatInput onSend={vi.fn()} loading={false} />);
    expect(screen.getByPlaceholderText('输入需求，三个 AI 角色将展开讨论...')).toBeInTheDocument();
  });

  it('输入框可以输入文字', async () => {
    render(<ChatInput onSend={vi.fn()} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '测试需求');
    expect(textarea).toHaveValue('测试需求');
  });

  it('文本为空时发送按钮禁用', () => {
    render(<ChatInput onSend={vi.fn()} loading={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('有文本且非加载时发送按钮启用', async () => {
    render(<ChatInput onSend={vi.fn()} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '需求');
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('loading 时发送按钮禁用', async () => {
    render(<ChatInput onSend={vi.fn()} loading={true} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '需求');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('loading 时输入框禁用', () => {
    render(<ChatInput onSend={vi.fn()} loading={true} />);
    expect(screen.getByPlaceholderText(/输入需求/)).toBeDisabled();
  });

  it('点击发送按钮调用 onSend 并清空输入', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '测试需求');
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).toHaveBeenCalledWith('测试需求');
    expect(textarea).toHaveValue('');
  });

  it('按 Enter 键调用 onSend', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '需求');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('需求');
  });

  it('Shift+Enter 不触发 onSend', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '需求');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('全空格文本不发送', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '   ');
    fireEvent.click(screen.getByRole('button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('发送后自动清空输入框', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} loading={false} />);
    const textarea = screen.getByPlaceholderText(/输入需求/);
    await userEvent.type(textarea, '需求');
    fireEvent.click(screen.getByRole('button'));
    expect(textarea).toHaveValue('');
  });
});
