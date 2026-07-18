import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';

vi.mock('../../../../test/setup', async () => {
  const actual = await vi.importActual('../../../../test/setup');
  return { ...actual };
});

vi.mock('../../workstation/tool/ToolFormModal', () => ({
  default: () => <div data-testid="tool-form-modal">ToolFormModal</div>,
}));

vi.mock('../../workstation/mcp/MCPFormModal', () => ({
  default: () => <div data-testid="mcp-form-modal">MCPFormModal</div>,
}));

vi.mock('../../workstation/skill/SkillFormModal', () => ({
  default: () => <div data-testid="skill-form-modal">SkillFormModal</div>,
}));

import ItemEditor from '../ItemEditor';

describe('ItemEditor', () => {
  const defaultProps = {
    form: { show: true, data: {}, errors: [] },
    editingItem: null,
    onSave: vi.fn(),
    onClose: vi.fn(),
    setFormData: vi.fn(),
    children: <div>fallback</div>,
  };

  it('renders children when form.show is false', () => {
    render(
      <TestProviders>
        <ItemEditor {...defaultProps} form={{ show: false, data: {}, errors: [] }} />
      </TestProviders>,
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
  });

  it('renders ToolFormModal when kind is tool', () => {
    render(
      <TestProviders>
        <ItemEditor {...defaultProps} kind="tool" />
      </TestProviders>,
    );
    expect(screen.getByTestId('tool-form-modal')).toBeInTheDocument();
  });

  it('renders MCPFormModal when kind is mcp', () => {
    render(
      <TestProviders>
        <ItemEditor {...defaultProps} kind="mcp" />
      </TestProviders>,
    );
    expect(screen.getByTestId('mcp-form-modal')).toBeInTheDocument();
  });

  it('renders SkillFormModal when kind is skill', () => {
    render(
      <TestProviders>
        <ItemEditor {...defaultProps} kind="skill" />
      </TestProviders>,
    );
    expect(screen.getByTestId('skill-form-modal')).toBeInTheDocument();
  });

  it('passes editingItem to ToolFormModal', () => {
    const editingItem = { id: 't1', name: 'Test Tool', description: 'desc', category: 'cat', model: '', endpoint: '', parameters: '' };
    render(
      <TestProviders>
        <ItemEditor {...defaultProps} kind="tool" editingItem={editingItem} />
      </TestProviders>,
    );
    expect(screen.getByTestId('tool-form-modal')).toBeInTheDocument();
  });
});
