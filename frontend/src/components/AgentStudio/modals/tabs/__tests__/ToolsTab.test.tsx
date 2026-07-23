import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolsTab } from '../ToolsTab';
import type { ToolFormData } from '../../../workstation/tool/tool.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../workstation/tool/ToolFormModal', () => ({
  default: () => <div data-testid="tool-form-modal" />,
}));
vi.mock('../../ConfigItemList', () => ({
  default: () => <div data-testid="config-item-list" />,
}));

const baseProps = {
  items: [], editingId: null, showForm: false,
  formData: {} as ToolFormData, formErrors: [], editingItem: null,
  onToggle: vi.fn(), onAdd: vi.fn(), onUpdate: vi.fn(),
  onRemove: vi.fn(), onStartEdit: vi.fn(), onFinishEdit: vi.fn(),
  onPickerOpen: vi.fn(), onCustomize: vi.fn(),
  onFormSave: vi.fn(), onFormClose: vi.fn(), setFormData: vi.fn(),
};

describe('ToolsTab', () => {
  it('renders ConfigItemList when showForm is false', () => {
    render(<ToolsTab {...baseProps} />);
    expect(screen.getByTestId('config-item-list')).toBeDefined();
  });

  it('renders ToolFormModal when showForm is true', () => {
    render(<ToolsTab {...baseProps} showForm={true} />);
    expect(screen.getByTestId('tool-form-modal')).toBeDefined();
  });
});
