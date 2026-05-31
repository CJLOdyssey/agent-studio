import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { AgentConfig } from '../../types';
import AgentEditModal from '../legacy/AgentEditModal';

describe('AgentEditModal', () => {
  const mockAgents: AgentConfig[] = [
    { id: '1', name: 'PM', role_identifier: 'pm', system_prompt: 'prompt1', model: null, temperature: null, order: 1, is_active: true, is_approver: false, icon: '📋', created_at: null },
    { id: '2', name: 'DEV', role_identifier: 'dev', system_prompt: 'prompt2', model: 'gpt-4', temperature: 0.5, order: 2, is_active: false, is_approver: true, icon: '⚙️', created_at: null },
  ];

  const defaultProps = {
    agent: null,
    allAgents: mockAgents,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };

  describe('新增模式', () => {
    it('显示添加标题', () => {
      render(<AgentEditModal {...defaultProps} />);
      expect(screen.getByText('添加团队成员')).toBeInTheDocument();
    });

    it('表单字段初始为空/默认值', () => {
      render(<AgentEditModal {...defaultProps} />);
      expect(screen.getByPlaceholderText('如：前端工程师')).toHaveValue('');
      expect(screen.getByPlaceholderText('如：frontend')).toHaveValue('');
    });

    it('不显示删除按钮', () => {
      render(<AgentEditModal {...defaultProps} />);
      expect(screen.queryByText('删除')).not.toBeInTheDocument();
    });

    it('名称为空时添加按钮禁用不触发 onSave', () => {
      render(<AgentEditModal {...defaultProps} />);
      const addBtn = screen.getByText('添加');
      expect(addBtn).toBeDisabled();
      fireEvent.click(addBtn);
      expect(defaultProps.onSave).not.toHaveBeenCalled();
    });
  });

  describe('编辑模式', () => {
    const editAgent: AgentConfig = {
      id: '3', name: '测试工程师', role_identifier: 'qa', system_prompt: '测试所有功能',
      model: 'deepseek-chat', temperature: 0.3, order: 3, is_active: true, is_approver: false,
      icon: '🧪', created_at: null,
    };

    const editProps = {
      agent: editAgent,
      allAgents: mockAgents,
      onSave: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
    };

    it('显示编辑标题', () => {
      render(<AgentEditModal {...editProps} />);
      expect(screen.getByText('编辑团队成员')).toBeInTheDocument();
    });

    it('表单预填已有数据', () => {
      render(<AgentEditModal {...editProps} />);
      expect(screen.getByDisplayValue('测试工程师')).toBeInTheDocument();
      expect(screen.getByDisplayValue('qa')).toBeInTheDocument();
      expect(screen.getByDisplayValue('测试所有功能')).toBeInTheDocument();
    });

    it('显示删除按钮', () => {
      render(<AgentEditModal {...editProps} />);
      expect(screen.getByText('删除')).toBeInTheDocument();
    });

    it('点击删除调用 onDelete', () => {
      render(<AgentEditModal {...editProps} />);
      fireEvent.click(screen.getByText('删除'));
      expect(editProps.onDelete).toHaveBeenCalledWith('3');
    });
  });

  describe('表单保存', () => {
    it('保存时格式化 role_identifier', async () => {
      const onSave = vi.fn();
      const { container } = render(<AgentEditModal agent={null} allAgents={mockAgents} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
      const nameInput = screen.getByPlaceholderText('如：前端工程师');
      const roleInput = screen.getByPlaceholderText('如：frontend');
      const promptInput = container.querySelector('textarea')!;
      await userEvent.type(nameInput, '新代理');
      await userEvent.type(roleInput, 'New Agent');
      await userEvent.type(promptInput, 'prompt');
      fireEvent.click(screen.getByText('添加'));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ role_identifier: 'new_agent' }),
      );
    });

    it('保存时 model 为 null 当自定义模型关闭时', async () => {
      const onSave = vi.fn();
      const agent: AgentConfig = { id: '1', name: 'A', role_identifier: 'a', system_prompt: 'p', model: null, temperature: null, order: 1, is_active: true, is_approver: false, icon: '◆', created_at: null };
      render(<AgentEditModal agent={agent} allAgents={mockAgents} onSave={onSave} onDelete={vi.fn()} onClose={vi.fn()} />);
      fireEvent.click(screen.getByText('保存'));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ model: null, temperature: null }));
    });
  });

  it('点击遮罩层调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<AgentEditModal agent={null} allAgents={mockAgents} onSave={vi.fn()} onDelete={vi.fn()} onClose={onClose} />);
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('点击弹窗内部不触发 onClose', () => {
    const onClose = vi.fn();
    render(<AgentEditModal agent={null} allAgents={mockAgents} onSave={vi.fn()} onDelete={vi.fn()} onClose={onClose} />);
    const modal = screen.getByText('添加团队成员').closest('.modal-content')!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });
});
