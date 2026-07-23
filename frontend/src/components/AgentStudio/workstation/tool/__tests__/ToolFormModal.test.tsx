import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../locales', () => ({ t: (key: string) => key }));

vi.mock('../../constants', () => ({
  useModelOptions: () => ['GPT-4o', 'Claude Opus 4', 'DeepSeek V3'],
}));

vi.mock('../../../../../api/client/tools', () => ({
  testTool: vi.fn(),
}));

import { EMPTY_FORM } from '../validate';
import ToolFormModal from '../ToolFormModal';
import { testTool } from '../../../../../api/client/tools';

const baseProps = {
  editingItem: null as Record<string, unknown> | null,
  formData: EMPTY_FORM,
  setFormData: vi.fn(),
  onSave: vi.fn(),
  onClose: vi.fn(),
  errors: [] as string[],
};

describe('ToolFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders create mode title', () => {
    render(<ToolFormModal {...baseProps} />);
    expect(screen.getByText('tool.form_title_new')).toBeInTheDocument();
  });

  it('renders edit mode title when editingItem is provided', () => {
    render(<ToolFormModal {...baseProps} editingItem={{ id: 't1' } as any} />);
    expect(screen.getByText('tool.form_title_edit')).toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<ToolFormModal {...baseProps} />);
    expect(screen.getByText('tool.form_name')).toBeInTheDocument();
    expect(screen.getByText('tool.form_desc')).toBeInTheDocument();
    expect(screen.getByText('tool.form_category')).toBeInTheDocument();
    expect(screen.getByText('tool.form_model')).toBeInTheDocument();
    expect(screen.getByText('tool.form_status')).toBeInTheDocument();
    expect(screen.getByText('tool.form_version')).toBeInTheDocument();
    expect(screen.getByText('tool.form_endpoint')).toBeInTheDocument();
    expect(screen.getByText('tool.form_parameters')).toBeInTheDocument();
  });

  it('shows validation errors', () => {
    render(<ToolFormModal {...baseProps} errors={['Name is required', 'Version is required']} />);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Version is required')).toBeInTheDocument();
  });

  it('calls setFormData on name input change', () => {
    const setFormData = vi.fn();
    render(<ToolFormModal {...baseProps} setFormData={setFormData} />);
    const input = screen.getByPlaceholderText('tool.form_name_placeholder');
    fireEvent.change(input, { target: { value: 'My Tool' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on description change', () => {
    const setFormData = vi.fn();
    render(<ToolFormModal {...baseProps} setFormData={setFormData} />);
    const textarea = screen.getByPlaceholderText('tool.form_desc_placeholder');
    fireEvent.change(textarea, { target: { value: 'A tool' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on category select change', () => {
    const setFormData = vi.fn();
    render(<ToolFormModal {...baseProps} setFormData={setFormData} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'API 工具' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on model select change', () => {
    const setFormData = vi.fn();
    render(<ToolFormModal {...baseProps} setFormData={setFormData} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'DeepSeek V3' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls setFormData on version input change', () => {
    const setFormData = vi.fn();
    render(<ToolFormModal {...baseProps} setFormData={setFormData} />);
    const input = screen.getByPlaceholderText('tool.form_version_placeholder');
    fireEvent.change(input, { target: { value: 'v2.0.0' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('calls onSave when save button clicked', () => {
    const onSave = vi.fn();
    render(<ToolFormModal {...baseProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('tool.form_save_create'));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<ToolFormModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('tool.form_cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<ToolFormModal {...baseProps} onClose={onClose} />);
    const closeBtn = document.querySelector('.modal-close') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when overlay clicked', () => {
    const onClose = vi.fn();
    render(<ToolFormModal {...baseProps} onClose={onClose} />);
    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when modal content clicked', () => {
    const onClose = vi.fn();
    render(<ToolFormModal {...baseProps} onClose={onClose} />);
    const modal = document.querySelector('.wsta-modal') as HTMLElement;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('test button is disabled when endpoint is empty', () => {
    const formData = { ...EMPTY_FORM, endpoint: '' };
    render(<ToolFormModal {...baseProps} formData={formData} />);
    const testBtn = screen.getByText('tool.test').closest('button');
    expect(testBtn).toBeDisabled();
  });

  it('test button is enabled when endpoint has value', () => {
    const formData = { ...EMPTY_FORM, endpoint: 'http://api.example.com' };
    render(<ToolFormModal {...baseProps} formData={formData} />);
    const testBtn = screen.getByText('tool.test').closest('button');
    expect(testBtn).not.toBeDisabled();
  });

  it('calls testTool when test button clicked with editingItem', async () => {
    vi.mocked(testTool).mockResolvedValue({ success: true, status_code: 200, duration_ms: 150, message: 'OK', body: null });
    const formData = { ...EMPTY_FORM, endpoint: 'http://api.example.com' };
    render(
      <ToolFormModal
        {...baseProps}
        formData={formData}
        editingItem={{ id: 't1', name: 'Test' } as any}
      />,
    );
    fireEvent.click(screen.getByText('tool.test'));
    await waitFor(() => {
      expect(vi.mocked(testTool)).toHaveBeenCalledWith('t1');
    });
  });

  it('shows test result after successful test', async () => {
    vi.mocked(testTool).mockResolvedValue({ success: true, status_code: 200, duration_ms: 150, message: 'OK', body: null });
    const formData = { ...EMPTY_FORM, endpoint: 'http://api.example.com' };
    render(
      <ToolFormModal
        {...baseProps}
        formData={formData}
        editingItem={{ id: 't1', name: 'Test' } as any}
      />,
    );
    fireEvent.click(screen.getByText('tool.test'));
    await waitFor(() => {
      expect(screen.getByText(/OK/)).toBeInTheDocument();
    });
  });

  it('shows edit mode save button text', () => {
    render(<ToolFormModal {...baseProps} editingItem={{ id: 't1' } as any} />);
    expect(screen.getByText('tool.form_save_edit')).toBeInTheDocument();
  });

  it('shows create mode save button text', () => {
    render(<ToolFormModal {...baseProps} />);
    expect(screen.getByText('tool.form_save_create')).toBeInTheDocument();
  });
});
