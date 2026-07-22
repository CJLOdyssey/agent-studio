import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptFormModal from '../PromptFormModal';
import type { PromptFormData } from '../types';
import { TestProviders } from '../../../../../test/setup';

const baseFormData: PromptFormData = {
  name: '', content: '', category: '系统提示词', model: 'GPT-4o', status: 'active', version: 'v1.0.0',
};

function renderModal(overrides?: Partial<Parameters<typeof renderModal>[0]>) {
  const props = {
    editingItem: null,
    formData: baseFormData,
    setFormData: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    errors: [] as string[],
    ...overrides,
  };
  return { ...render(<TestProviders><PromptFormModal {...props} /></TestProviders>), props };
}

describe('PromptFormModal', () => {
  it('renders create title when editingItem is null', () => {
    renderModal();
    expect(screen.getByText('新建提示词')).toBeInTheDocument();
  });

  it('renders edit title when editingItem is provided', () => {
    renderModal({ editingItem: { id: 'p1', ...baseFormData, createdAt: '2026-01-01' } });
    expect(screen.getByText('编辑提示词')).toBeInTheDocument();
  });

  it('shows validation errors', () => {
    renderModal({ errors: ['名称不能为空', '内容不能为空'] });
    expect(screen.getByText('名称不能为空')).toBeInTheDocument();
    expect(screen.getByText('内容不能为空')).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', async () => {
    const { props } = renderModal();
    await userEvent.click(screen.getByText('创建提示词'));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when close button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('关闭'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('calls setFormData when name input changes', async () => {
    const { props } = renderModal({ formData: { ...baseFormData, name: '' } });
    const input = screen.getByPlaceholderText('2-50 个字符');
    await userEvent.type(input, '测试');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('shows token estimate', () => {
    renderModal({ formData: { ...baseFormData, content: 'Hello World' } });
    expect(screen.getByText(/tokens?/i)).toBeInTheDocument();
  });
});
