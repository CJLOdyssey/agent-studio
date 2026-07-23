import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../locales', () => ({ t: (k: string) => k }));
vi.mock('../../../../../api/client/teams', () => ({ listTeams: () => Promise.resolve([]) }));
vi.mock('../ResourcePickerSection', () => ({
  ResourcePickerSection: vi.fn(() => <div data-testid="resource-picker-section" />),
}));
vi.mock('../../shared/ResourcePickerModal', () => ({ default: () => null }));

import AgentFormModal from '../AgentFormModal';
import type { AgentFormData, AgentEntry } from '../agent.types';
import { ResourcePickerSection } from '../ResourcePickerSection';

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

function makeFormData(overrides: Partial<AgentFormData> = {}): AgentFormData {
  return {
    name: '',
    version: 'v1.0.0',
    systemPromptId: '',
    toolIds: [],
    mcpIds: [],
    skillIds: [],
    description: '',
    team: '',
    teams: [],
    model: '',
    status: 'stopped',
    ...overrides,
  };
}

function makeAgentEntry(overrides: Partial<AgentEntry> = {}): AgentEntry {
  return {
    id: 'a1',
    name: 'My Agent',
    description: 'An agent',
    team: 'Team A',
    teams: ['Team A'],
    model: 'GPT-4o',
    status: 'stopped' as const,
    version: 'v1.0.0',
    systemPromptId: 'p1',
    toolIds: [],
    mcpIds: [],
    skillIds: [],
    createdAt: '2024-01-01',
    ...overrides,
  };
}

const baseProps = {
  editingAgent: null as AgentEntry | null,
  formData: makeFormData(),
  setFormData: vi.fn(),
  formErrors: [] as string[],
  onSave: vi.fn(),
  onClose: vi.fn(),
  availablePrompts: [],
  availableTools: [],
  availableMCPs: [],
  availableSkills: [],
};

describe('AgentFormModal', () => {
  it('renders create mode', () => {
    const { container } = render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(container).toBeDefined();
  });

  it('renders create mode title when no editingAgent', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('agent.form_create_title')).toBeInTheDocument();
  });

  it('renders edit mode title when editingAgent is provided', () => {
    render(<AgentFormModal {...baseProps} editingAgent={makeAgentEntry()} />, { wrapper: Wrapper });
    expect(screen.getByText('agent.form_edit_title')).toBeInTheDocument();
  });

  it('renders name input with placeholder', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('agent.form_name_placeholder')).toBeInTheDocument();
  });

  it('renders name input with current form value', () => {
    render(
      <AgentFormModal {...baseProps} formData={makeFormData({ name: 'Test Agent' })} />,
      { wrapper: Wrapper }
    );
    const input = screen.getByPlaceholderText('agent.form_name_placeholder') as HTMLInputElement;
    expect(input.value).toBe('Test Agent');
  });

  it('name input has maxLength of 30', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    const input = screen.getByPlaceholderText('agent.form_name_placeholder') as HTMLInputElement;
    expect(input.maxLength).toBe(30);
  });

  it('renders description textarea', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('agent.form_desc_placeholder')).toBeInTheDocument();
  });

  it('renders version input', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('agent.form_version_placeholder')).toBeInTheDocument();
  });

  it('renders team select dropdown', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    // The team label should be present
    expect(screen.getByText('agent.form_team')).toBeInTheDocument();
  });

  it('renders model select dropdown', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    // The model label should be present
    expect(screen.getByText('agent.form_model')).toBeInTheDocument();
  });

  it('renders model select with default options', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    const selects = screen.getAllByRole('combobox');
    // The model select should be one of the comboboxes
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders ResourcePickerSection', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByTestId('resource-picker-section')).toBeInTheDocument();
  });

  it('passes available resources to ResourcePickerSection', () => {
    const prompts = [{ id: 'p1', name: 'Prompt 1' }];
    const tools = [{ id: 't1', name: 'Tool 1' }];
    const mcps = [{ id: 'm1', name: 'MCP 1' }];
    const skills = [{ id: 's1', name: 'Skill 1' }];
    render(
      <AgentFormModal
        {...baseProps}
        availablePrompts={prompts}
        availableTools={tools}
        availableMCPs={mcps}
        availableSkills={skills}
      />,
      { wrapper: Wrapper }
    );
    const lastCall = (ResourcePickerSection as ReturnType<typeof vi.fn>).mock.lastCall?.[0];
    expect(lastCall.availablePrompts).toEqual(prompts);
    expect(lastCall.availableTools).toEqual(tools);
    expect(lastCall.availableMCPs).toEqual(mcps);
    expect(lastCall.availableSkills).toEqual(skills);
  });

  it('passes selected prompt to ResourcePickerSection', () => {
    const prompts = [{ id: 'p1', name: 'Prompt 1' }];
    render(
      <AgentFormModal
        {...baseProps}
        formData={makeFormData({ systemPromptId: 'p1' })}
        availablePrompts={prompts}
      />,
      { wrapper: Wrapper }
    );
    const lastCall = (ResourcePickerSection as ReturnType<typeof vi.fn>).mock.lastCall?.[0];
    expect(lastCall.selectedPrompt).toEqual({ id: 'p1', name: 'Prompt 1' });
  });

  it('passes selected tools to ResourcePickerSection', () => {
    const tools = [{ id: 't1', name: 'Tool 1' }];
    render(
      <AgentFormModal
        {...baseProps}
        formData={makeFormData({ toolIds: ['t1'] })}
        availableTools={tools}
      />,
      { wrapper: Wrapper }
    );
    const lastCall = (ResourcePickerSection as ReturnType<typeof vi.fn>).mock.lastCall?.[0];
    expect(lastCall.selectedTools).toEqual([{ id: 't1', name: 'Tool 1' }]);
  });

  it('passes selected MCPs to ResourcePickerSection', () => {
    const mcps = [{ id: 'm1', name: 'MCP 1' }];
    render(
      <AgentFormModal
        {...baseProps}
        formData={makeFormData({ mcpIds: ['m1'] })}
        availableMCPs={mcps}
      />,
      { wrapper: Wrapper }
    );
    const lastCall = (ResourcePickerSection as ReturnType<typeof vi.fn>).mock.lastCall?.[0];
    expect(lastCall.selectedMCPs).toEqual([{ id: 'm1', name: 'MCP 1' }]);
  });

  it('passes selected skills to ResourcePickerSection', () => {
    const skills = [{ id: 's1', name: 'Skill 1' }];
    render(
      <AgentFormModal
        {...baseProps}
        formData={makeFormData({ skillIds: ['s1'] })}
        availableSkills={skills}
      />,
      { wrapper: Wrapper }
    );
    const lastCall = (ResourcePickerSection as ReturnType<typeof vi.fn>).mock.lastCall?.[0];
    expect(lastCall.selectedSkills).toEqual([{ id: 's1', name: 'Skill 1' }]);
  });

  it('calls onClose when clicking X button', () => {
    const onClose = vi.fn();
    render(<AgentFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const closeBtn = document.querySelector('.modal-close') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking cancel button', () => {
    const onClose = vi.fn();
    render(<AgentFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const cancelBtn = screen.getByText('agent.form_cancel');
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSave when clicking save button', () => {
    const onSave = vi.fn();
    render(<AgentFormModal {...baseProps} onSave={onSave} />, { wrapper: Wrapper });
    const saveBtn = screen.getByText('agent.form_save_create');
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking overlay', () => {
    const onClose = vi.fn();
    render(<AgentFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking modal content', () => {
    const onClose = vi.fn();
    render(<AgentFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const modalContent = document.querySelector('.wsta-agent-form-modal');
    fireEvent.click(modalContent!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<AgentFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.keyDown(overlay!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    render(<AgentFormModal {...baseProps} onClose={onClose} />, { wrapper: Wrapper });
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.keyDown(overlay!, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls setFormData on name change', () => {
    const setFormData = vi.fn();
    render(<AgentFormModal {...baseProps} setFormData={setFormData} />, { wrapper: Wrapper });
    const input = screen.getByPlaceholderText('agent.form_name_placeholder');
    fireEvent.change(input, { target: { value: 'New Agent Name' } });
    expect(setFormData).toHaveBeenCalled();
  });

  it('shows create button text in create mode', () => {
    render(<AgentFormModal {...baseProps} editingAgent={null} />, { wrapper: Wrapper });
    expect(screen.getByText('agent.form_save_create')).toBeInTheDocument();
  });

  it('shows edit button text in edit mode', () => {
    render(<AgentFormModal {...baseProps} editingAgent={makeAgentEntry()} />, { wrapper: Wrapper });
    expect(screen.getByText('agent.form_save_edit')).toBeInTheDocument();
  });

  it('renders section title for basic info', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(screen.getByText('agent.form_section_basic')).toBeInTheDocument();
  });

  it('renders required asterisk on name field', () => {
    render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    const labels = document.querySelectorAll('.wsta-label');
    const nameLabel = labels[0];
    expect(nameLabel.textContent).toContain('*');
  });

  it('renders version input with current value', () => {
    render(<AgentFormModal {...baseProps} formData={makeFormData({ version: 'v2.0.0' })} />, { wrapper: Wrapper });
    const versionInput = screen.getByPlaceholderText('agent.form_version_placeholder') as HTMLInputElement;
    expect(versionInput.value).toBe('v2.0.0');
  });

  it('renders modal with correct CSS class', () => {
    const { container } = render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(container.querySelector('.wsta-agent-form-modal')).toBeInTheDocument();
  });

  it('renders header with Bot icon', () => {
    const { container } = render(<AgentFormModal {...baseProps} />, { wrapper: Wrapper });
    expect(container.querySelector('.modal-title')).toBeInTheDocument();
  });
});
