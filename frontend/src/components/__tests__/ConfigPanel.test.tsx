import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfigPanel from '../shared/ConfigPanel';

describe('ConfigPanel', () => {
  it('渲染配置弹窗标题', () => {
    render(<ConfigPanel onClose={() => {}} />);
    expect(screen.getByText('⚙️ 配置')).toBeInTheDocument();
  });

  it('显示后端环境变量说明文字', () => {
    render(<ConfigPanel onClose={() => {}} />);
    expect(screen.getByText(/环境变量/)).toBeInTheDocument();
    expect(screen.getByText(/DEEPSEEK_API_KEY/)).toBeInTheDocument();
  });

  it('渲染关闭按钮', () => {
    render(<ConfigPanel onClose={() => {}} />);
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
  });

  it('点击遮罩层调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<ConfigPanel onClose={onClose} />);
    fireEvent.click(container.querySelector('.config-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('点击弹窗内部不触发 onClose', () => {
    const onClose = vi.fn();
    render(<ConfigPanel onClose={onClose} />);
    const modal = screen.getByText('⚙️ 配置').closest('.config-modal')!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('点击关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    render(<ConfigPanel onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
