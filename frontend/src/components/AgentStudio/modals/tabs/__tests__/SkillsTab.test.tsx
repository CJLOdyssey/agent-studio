import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillsTab } from '../SkillsTab';
import type { SkillFormData } from '../../../workstation/skill/skill.types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../workstation/skill/SkillFormModal', () => ({
  default: () => <div data-testid="skill-form-modal" />,
}));
vi.mock('../../ConfigItemList', () => ({
  default: () => <div data-testid="config-item-list" />,
}));

const baseProps = {
  items: [], editingId: null, showForm: false,
  formData: {} as SkillFormData, formErrors: [], editingItem: null,
  onToggle: vi.fn(), onAdd: vi.fn(), onUpdate: vi.fn(),
  onRemove: vi.fn(), onStartEdit: vi.fn(), onFinishEdit: vi.fn(),
  onPickerOpen: vi.fn(), onCustomize: vi.fn(),
  onFormSave: vi.fn(), onFormClose: vi.fn(), setFormData: vi.fn(),
};

describe('SkillsTab', () => {
  it('renders ConfigItemList when showForm is false', () => {
    render(<SkillsTab {...baseProps} />);
    expect(screen.getByTestId('config-item-list')).toBeDefined();
  });

  it('renders SkillFormModal when showForm is true', () => {
    render(<SkillsTab {...baseProps} showForm={true} />);
    expect(screen.getByTestId('skill-form-modal')).toBeDefined();
  });
});
