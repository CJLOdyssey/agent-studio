import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { RunResult } from '../../types';
import ResultDisplay from '../legacy/ResultDisplay';

describe('ResultDisplay', () => {
  const baseResult: RunResult = {
    requirement: '测试需求描述',
    pm_document: '需求文档内容',
    code: 'console.log("hello");',
    review: '测试通过',
    approved: true,
    status: 'converged',
  };

  it('approved=true 显示通过状态', () => {
    render(<ResultDisplay result={{ ...baseResult, approved: true }} />);
    expect(screen.getByText(/讨论结果/)).toHaveTextContent('✅');
    expect(screen.getByText(/讨论结果/)).toHaveTextContent('通过');
  });

  it('approved=false 显示驳回状态', () => {
    render(<ResultDisplay result={{ ...baseResult, approved: false }} />);
    expect(screen.getByText(/讨论结果/)).toHaveTextContent('❌');
    expect(screen.getByText(/讨论结果/)).toHaveTextContent('驳回');
  });

  it('默认展开需求文档，折叠代码和评审', () => {
    render(<ResultDisplay result={baseResult} />);
    expect(screen.getByText('需求文档内容')).toBeVisible();
    expect(screen.queryByText('console.log')).not.toBeInTheDocument();
    expect(screen.queryByText('测试通过')).not.toBeInTheDocument();
  });

  it('点击代码产出切换折叠', () => {
    render(<ResultDisplay result={baseResult} />);
    fireEvent.click(screen.getByText('💻 代码产出'));
    expect(screen.getByText('console.log("hello");')).toBeVisible();
    fireEvent.click(screen.getByText('💻 代码产出'));
    expect(screen.queryByText('console.log("hello");')).not.toBeInTheDocument();
  });

  it('点击测试评审切换折叠', () => {
    render(<ResultDisplay result={baseResult} />);
    fireEvent.click(screen.getByText('🧪 测试评审'));
    expect(screen.getByText('测试通过')).toBeVisible();
    fireEvent.click(screen.getByText('🧪 测试评审'));
    expect(screen.queryByText('测试通过')).not.toBeInTheDocument();
  });

  it('内容为空时文档展开显示 "无"', () => {
    render(<ResultDisplay result={{ ...baseResult, pm_document: '', code: '', review: '' }} />);
    expect(screen.getAllByText('无')).toHaveLength(1);
  });

  it('渲染三个折叠面板标题', () => {
    render(<ResultDisplay result={baseResult} />);
    expect(screen.getByText('📋 需求文档')).toBeInTheDocument();
    expect(screen.getByText('💻 代码产出')).toBeInTheDocument();
    expect(screen.getByText('🧪 测试评审')).toBeInTheDocument();
  });
});
