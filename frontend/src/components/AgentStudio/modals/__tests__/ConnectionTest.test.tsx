import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';
import ConnectionTest from '../ConnectionTest';

describe('ConnectionTest', () => {
  const baseProps = {
    onTest: vi.fn(),
    disabled: false,
    testing: false,
    testResult: null as { success: boolean; message: string; latency?: number } | null,
  };

  it('renders test button when not tested', () => {
    render(<TestProviders><ConnectionTest {...baseProps} /></TestProviders>);
    expect(screen.getByText('测试连接')).toBeInTheDocument();
  });

  it('shows spinner during testing', () => {
    render(<TestProviders><ConnectionTest {...baseProps} testing={true} /></TestProviders>);
    expect(screen.getByText('测试中...')).toBeInTheDocument();
  });

  it('shows success result', () => {
    render(<TestProviders><ConnectionTest {...baseProps} testResult={{ success: true, message: '连接成功', latency: 120 }} /></TestProviders>);
    expect(screen.getByText('✅ 连接成功')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
  });

  it('shows failure result', () => {
    render(<TestProviders><ConnectionTest {...baseProps} testResult={{ success: false, message: 'Invalid API key', latency: 0 }} /></TestProviders>);
    expect(screen.getByText('❌ Invalid API key')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<TestProviders><ConnectionTest {...baseProps} disabled={true} /></TestProviders>);
    expect(screen.getByText('测试连接').closest('button')).toBeDisabled();
  });

  it('calls onTest when test button is clicked', () => {
    const onTest = vi.fn();
    render(<TestProviders><ConnectionTest {...baseProps} onTest={onTest} /></TestProviders>);
    fireEvent.click(screen.getByText('测试连接'));
    expect(onTest).toHaveBeenCalled();
  });
});
