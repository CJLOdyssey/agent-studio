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

describe('OutputFormModal', { tags: ['unit'] }, () => {
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

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    const overlay = container.querySelector('.modal-overlay');
    expect(overlay).toBeDefined();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking modal content', () => {
    const onClose = vi.fn();
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    const modalContent = container.querySelector('.modal-content');
    expect(modalContent).toBeDefined();
    fireEvent.click(modalContent!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on close X button click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={onClose}
      />,
    );

    const closeBtn = container.querySelector('.modal-close');
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls setFormData on content textarea change', () => {
    const setFormData = vi.fn();
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={setFormData}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const textarea = screen.getByPlaceholderText('输入内容');
    fireEvent.change(textarea, { target: { value: 'New content' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on category select change', () => {
    const setFormData = vi.fn();
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={setFormData}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
    const categorySelect = selects[0];
    fireEvent.change(categorySelect, { target: { value: '长度约束' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on status select change', () => {
    const setFormData = vi.fn();
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={setFormData}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
    const statusSelect = selects[1];
    fireEvent.change(statusSelect, { target: { value: 'archived' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('enables save button when both name and content are filled', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={{ ...defaultFormData, name: 'Valid Name', content: 'Valid Content' }}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('创建')).not.toBeDisabled();
  });

  it('disables save button when only name is empty', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={{ ...defaultFormData, name: '', content: 'Some content' }}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('创建')).toBeDisabled();
  });

  it('disables save button when only content is empty', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={{ ...defaultFormData, name: 'Some name', content: '' }}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('创建')).toBeDisabled();
  });

  it('does not render error section when formErrors is undefined', () => {
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
        formErrors={undefined}
      />,
    );

    expect(container.querySelector('.wsta-form-errors')).toBeNull();
  });

  it('does not render error section when formErrors is empty array', () => {
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
        formErrors={[]}
      />,
    );

    expect(container.querySelector('.wsta-form-errors')).toBeNull();
  });

  it('renders category options correctly', () => {
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll('select');
    const categorySelect = selects[0];
    const options = Array.from(categorySelect.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('格式约束');
    expect(options).toContain('内容约束');
    expect(options).toContain('语言约束');
    expect(options).toContain('长度约束');
  });

  it('renders status options correctly', () => {
    const { container } = render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const selects = container.querySelectorAll('select');
    const statusSelect = selects[1];
    const options = Array.from(statusSelect.querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('active');
    expect(options).toContain('draft');
    expect(options).toContain('archived');
  });

  it('sets maxLength on name input', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('输入名称');
    expect(input.getAttribute('maxLength')).toBe('50');
  });

  it('renders aria-modal="true" for accessibility', () => {
    render(
      <OutputFormModal
        editingItem={null}
        formData={defaultFormData}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('closes on non-Escape key without calling onClose', () => {
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

    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
