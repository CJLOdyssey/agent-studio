import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptFormModal from '../PromptFormModal';
import type { PromptFormData } from '../types';
import { TestProviders } from '../../../../../test/setup';

const baseFormData: PromptFormData = {
  name: '', description: '', content: '', category: '系统提示词', model: 'GPT-4o', status: 'active', version: 'v1.0.0',
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

describe('PromptFormModal', { tags: ['unit'] }, () => {
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

  it('renders description input', () => {
    renderModal();
    expect(screen.getByPlaceholderText('简述该提示词的用途，便于 Agent 选用时识别…')).toBeInTheDocument();
  });

  it('calls setFormData when description input changes', async () => {
    const { props } = renderModal();
    const input = screen.getByPlaceholderText('简述该提示词的用途，便于 Agent 选用时识别…');
    await userEvent.type(input, '用于代码审查');
    expect(props.setFormData).toHaveBeenCalled();
  });

  it('shows required marker on description label', () => {
    renderModal();
    const label = screen.getByText('提示词描述').closest('label');
    expect(label?.querySelector('.text-\\[var\\(--color-danger\\)\\]')).toBeInTheDocument();
  });

  it('does not mark version as required', () => {
    renderModal();
    const label = screen.getByText('版本').closest('label');
    expect(label?.querySelector('.text-\\[var\\(--color-danger\\)\\]')).toBeNull();
  });

  it('aligns model to first option when create-mode model is unknown', () => {
    const { props } = renderModal({ formData: { ...baseFormData, model: 'UNKNOWN-MODEL' } });
    const updater = props.setFormData.mock.calls[0][0];
    const next = updater({ ...baseFormData, model: 'UNKNOWN-MODEL' });
    expect(next.model).toBe('GPT-4o');
  });

  it('does not align model when editing', () => {
    const { props } = renderModal({
      editingItem: { id: 'p1', ...baseFormData, createdAt: '2026-01-01' },
      formData: { ...baseFormData, model: 'UNKNOWN-MODEL' },
    });
    expect(props.setFormData).not.toHaveBeenCalled();
  });

  it.todo('shows token estimate');
});
