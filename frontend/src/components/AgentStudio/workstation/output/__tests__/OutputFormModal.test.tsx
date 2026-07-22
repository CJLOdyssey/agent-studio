import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OutputFormModal from '../OutputFormModal';

vi.mock('../locales', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'output.form_title_new': '新建约束',
      'output.form_title_edit': '编辑约束',
      'output.form_name': '名称',
      'output.form_content': '内容',
      'output.form_category': '分类',
      'output.form_status': '状态',
      'output.form_cancel': '取消',
      'output.form_save_create': '创建',
      'output.form_save_edit': '保存',
      'output.form_name_placeholder': '输入名称',
      'output.form_content_placeholder': '输入内容',
    };
    return map[key] || key;
  },
}));

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
}));

const defaultFormData = {
  name: 'Test Rule',
  content: 'Must be valid JSON',
  category: '格式约束' as const,
  status: 'active' as const,
};

describe('OutputFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create form when no editingItem', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('新建约束')).toBeInTheDocument();
    expect(screen.getByText('创建')).toBeInTheDocument();
  });

  it('renders edit form when editingItem provided', () => {
    render(
      <OutputFormModal
        editingItem={{ id: '1', name: 'Old', content: 'Old', category: '格式约束', status: 'active' }}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('编辑约束')).toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
  });

  it('shows form errors when provided', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
        formErrors={['名称不能为空', '内容不能为空']}
      />,
    );

    expect(screen.getByText('名称不能为空')).toBeInTheDocument();
    expect(screen.getByText('内容不能为空')).toBeInTheDocument();
  });

  it('calls setFormData on name input change', () => {
    const setFormData = vi.fn();
    render(
      <OutputFormModal
        editingItem={null}
        formData={{ ...defaultFormData, name: '' }}
        setFormData={setFormData}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('输入名称');
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls onClose on cancel button click', () => {
    const onClose = vi.fn();
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave on save button click', () => {
    const onSave = vi.fn();
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('创建'));
    expect(onSave).toHaveBeenCalled();
  });

  it('disables save button when name or content is empty', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={{ name: '', content: '', category: '格式约束', status: 'active' }}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('创建')).toBeDisabled();
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
