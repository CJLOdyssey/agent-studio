import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const mockSetActivePicker = vi.fn();
const mockSetFormData = vi.fn();

vi.mock('../locales', () => ({ t: (k: string) => k, setLang: vi.fn(), getLang: () => 'zh' }));
vi.mock('../../shared/ResourcePickerModal', () => ({
  default: vi.fn(({ onClose }) => <div data-testid="resource-picker-modal"><button onClick={onClose}>Close</button></div>),
}));

import { ResourcePickerSection } from '../ResourcePickerSection';

const baseFormData = {
  name: '', description: '', team: '前端团队', model: 'GPT-4o',
  status: 'stopped' as const, version: 'v1.0.0',
  systemPromptId: '', toolIds: [] as string[], mcpIds: [] as string[], skillIds: [] as string[],
};

function renderComponent(overrides: Record<string, any> = {}) {
  const props = {
    formData: baseFormData,
    setFormData: mockSetFormData,
    activePicker: null as string | null,
    setActivePicker: mockSetActivePicker,
    selectedPrompt: null as { id: string; name: string } | null,
    selectedTools: [] as { id: string; name: string }[],
    selectedMCPs: [] as { id: string; name: string }[],
    selectedSkills: [] as { id: string; name: string }[],
    availablePrompts: [] as { id: string; name: string }[],
    availableTools: [] as { id: string; name: string }[],
    availableMCPs: [] as { id: string; name: string }[],
    availableSkills: [] as { id: string; name: string }[],
    ...overrides,
  };
  return render(<TestProviders><ResourcePickerSection {...props} /></TestProviders>);
}

describe('ResourcePickerSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section title', () => {
    renderComponent();
    expect(screen.getByText('agent.form_section_bindings')).toBeInTheDocument();
  });

  it('renders prompt picker trigger', () => {
    renderComponent();
    expect(screen.getByText('agent.form_prompt_empty')).toBeInTheDocument();
  });

  it('renders tools picker with count', () => {
    renderComponent();
    expect(screen.getByText((c) => c.startsWith('agent.form_tools'))).toBeInTheDocument();
    expect(screen.getByText('agent.form_tool_select')).toBeInTheDocument();
  });

  it('renders MCP picker with count', () => {
    renderComponent();
    const mcpLabels = screen.getAllByText((c) => c.startsWith('agent.form_mcp'));
    expect(mcpLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('agent.form_mcp_select')).toBeInTheDocument();
  });

  it('renders skills picker with count', () => {
    renderComponent();
    expect(screen.getByText((c) => c.startsWith('agent.form_skills'))).toBeInTheDocument();
    expect(screen.getByText('agent.form_skill_select')).toBeInTheDocument();
  });

  it('shows selected prompt name when selected', () => {
    renderComponent({ selectedPrompt: { id: 'p1', name: 'My Prompt' } });
    expect(screen.getByText('My Prompt')).toBeInTheDocument();
  });

  it('opens picker when prompt trigger clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('agent.form_prompt_empty'));
    expect(mockSetActivePicker).toHaveBeenCalledWith('prompt');
  });

  it('opens picker when tools trigger clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('agent.form_tool_select'));
    expect(mockSetActivePicker).toHaveBeenCalledWith('tools');
  });

  it('opens picker when MCP trigger clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('agent.form_mcp_select'));
    expect(mockSetActivePicker).toHaveBeenCalledWith('mcp');
  });

  it('opens picker when skills trigger clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('agent.form_skill_select'));
    expect(mockSetActivePicker).toHaveBeenCalledWith('skills');
  });

  it('renders without crash', () => {
    expect(() => renderComponent()).not.toThrow();
  });

  it('renders resource grid', () => {
    const { container } = renderComponent();
    expect(container.querySelector('.wsta-resource-grid')).toBeInTheDocument();
  });

  it('renders form section wrapper', () => {
    const { container } = renderComponent();
    expect(container.querySelector('.wsta-form-section')).toBeInTheDocument();
  });

  it('renders chips when tools are selected', () => {
    renderComponent({ selectedTools: [{ id: 't1', name: 'Tool A' }, { id: 't2', name: 'Tool B' }] });
    expect(screen.getByText('Tool A')).toBeInTheDocument();
    expect(screen.getByText('Tool B')).toBeInTheDocument();
  });

  it('renders chips when MCPs are selected', () => {
    renderComponent({ selectedMCPs: [{ id: 'm1', name: 'MCP X' }] });
    expect(screen.getByText('MCP X')).toBeInTheDocument();
  });

  it('renders chips when skills are selected', () => {
    renderComponent({ selectedSkills: [{ id: 's1', name: 'Skill Y' }] });
    expect(screen.getByText('Skill Y')).toBeInTheDocument();
  });

  it('renders tool chip remove button and calls setFormData', () => {
    const setFormData = vi.fn();
    const formData = { ...baseFormData, toolIds: ['t1'] };
    renderComponent({ setFormData, formData, selectedTools: [{ id: 't1', name: 'Tool A' }] });
    const removeBtns = document.querySelectorAll('.wsta-picker-chip-remove');
    expect(removeBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(removeBtns[0]);
    expect(setFormData).toHaveBeenCalled();
  });

  it('renders ResourcePickerModal when activePicker is set', () => {
    renderComponent({ activePicker: 'prompt', availablePrompts: [{ id: 'p1', name: 'Prompt 1' }] });
    expect(screen.getByTestId('resource-picker-modal')).toBeInTheDocument();
  });

  it('renders ResourcePickerModal for tools activePicker', () => {
    renderComponent({ activePicker: 'tools', availableTools: [{ id: 't1', name: 'Tool 1' }] });
    expect(screen.getByTestId('resource-picker-modal')).toBeInTheDocument();
  });

  it('renders ResourcePickerModal for mcp activePicker', () => {
    renderComponent({ activePicker: 'mcp', availableMCPs: [{ id: 'm1', name: 'MCP 1' }] });
    expect(screen.getByTestId('resource-picker-modal')).toBeInTheDocument();
  });

  it('renders ResourcePickerModal for skills activePicker', () => {
    renderComponent({ activePicker: 'skills', availableSkills: [{ id: 's1', name: 'Skill 1' }] });
    expect(screen.getByTestId('resource-picker-modal')).toBeInTheDocument();
  });
});
