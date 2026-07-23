import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MCPTab } from '../MCPTab';
import type { MCPFormData } from '../../../workstation/mcp/mcp.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../workstation/mcp/MCPFormModal', () => ({
  default: () => <div data-testid="mcp-form-modal" />,
}));
vi.mock('../../ConfigItemList', () => ({
  default: () => <div data-testid="config-item-list" />,
}));

const baseProps = {
  items: [], editingId: null, showForm: false,
  formData: {} as MCPFormData, formErrors: [], editingItem: null,
  onToggle: vi.fn(), onAdd: vi.fn(), onUpdate: vi.fn(),
  onRemove: vi.fn(), onStartEdit: vi.fn(), onFinishEdit: vi.fn(),
  onPickerOpen: vi.fn(), onCustomize: vi.fn(),
  onFormSave: vi.fn(), onFormClose: vi.fn(), setFormData: vi.fn(),
};

describe('MCPTab', () => {
  it('renders ConfigItemList when showForm is false', () => {
    render(<MCPTab {...baseProps} />);
    expect(screen.getByTestId('config-item-list')).toBeDefined();
  });

  it('renders MCPFormModal when showForm is true', () => {
    render(<MCPTab {...baseProps} showForm={true} />);
    expect(screen.getByTestId('mcp-form-modal')).toBeDefined();
  });
});
