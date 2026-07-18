import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LucideIcon } from 'lucide-react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';
import AgentConfigModal from '../AgentConfigModal';
import type { Agent } from '../../../types/AgentStudio';

function renderWithProviders(ui: React.ReactElement) {
  return render(<TestProviders>{ui}</TestProviders>);
}

vi.mock('../../workstation/prompt/api', () => ({
  promptAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../workstation/output/api', () => ({
  outputAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../workstation/tool/api', () => ({
  toolAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../workstation/mcp/api', () => ({
  mcpAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../workstation/skill/api', () => ({
  skillAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  role: 'Test role',
  icon: vi.fn(() => null) as unknown as LucideIcon,
  color: '',
  bg: '',
  border: '',
  systemPrompt: 'You are a test agent',
  outputConstraints: 'Output in JSON',
  tools: [{ id: 't1', name: 'tool1', description: 'desc', enabled: true, parameters: '' }],
  mcp: [{ id: 'm1', name: 'mcp1', description: 'desc', enabled: true }],
  skills: [{ id: 's1', name: 'skill1', description: 'desc', enabled: true }],
  isConfigured: true,
  isActive: true,
  order: 0,
};

function renderModal(overrides?: Record<string, unknown>) {
  const props = {
    agent: mockAgent,
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...renderWithProviders(<AgentConfigModal {...props} />), props };
}

describe('AgentConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders agent name and description in inputs', () => {
    renderModal();
    expect(screen.getByDisplayValue('Test Agent')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test role')).toBeInTheDocument();
  });

  it('shows all 5 tabs', () => {
    renderModal();
    expect(screen.getByText('workstation.prompt')).toBeInTheDocument();
    expect(screen.getByText('workstation.output')).toBeInTheDocument();
    expect(screen.getByText('workstation.tools')).toBeInTheDocument();
    expect(screen.getByText('MCP')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('renders SystemPromptTab by default', () => {
    renderModal();
    expect(screen.getByPlaceholderText('workstation.systemPromptDesc')).toBeInTheDocument();
  });

  it('switches to tools tab on click', () => {
    renderModal();
    fireEvent.click(screen.getByText('workstation.tools'));
    expect(screen.getByText((content) => content.startsWith('workstation.tools'))).toBeInTheDocument();
  });

  it('switches to MCP tab on click', () => {
    renderModal();
    fireEvent.click(screen.getByText('MCP'));
    expect(screen.getByText('MCP (1)')).toBeInTheDocument();
  });

  it('switches to Skills tab on click', () => {
    renderModal();
    fireEvent.click(screen.getByText('Skills'));
    expect(screen.getByText('Skills (1)')).toBeInTheDocument();
  });

  it('switches to output tab on click', () => {
    renderModal();
    fireEvent.click(screen.getByText('workstation.output'));
    expect(screen.getByPlaceholderText('workstation.outputConstraintDesc')).toBeInTheDocument();
  });

  it('calls onClose when Escape pressed', () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onSave when save button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('workstation.saveConfig'));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('save button disabled when name is empty', () => {
    renderModal();
    fireEvent.change(screen.getByDisplayValue('Test Agent'), { target: { value: '' } });
    expect(screen.getByText('workstation.saveConfig')).toBeDisabled();
  });

  it('calls onClose when cancel clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('workstation.cancel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('renders modal title with agent name', () => {
    renderModal();
    expect(screen.getByText('workstation.agentManage')).toBeInTheDocument();
  });

  it('shows tool list items', () => {
    renderModal();
    const btn = screen.getByText('workstation.tools');
    fireEvent.click(btn);
    expect(screen.getByText('tool1')).toBeInTheDocument();
  });

  it('shows mcp list items', () => {
    renderModal();
    fireEvent.click(screen.getByText('MCP'));
    expect(screen.getByText('mcp1')).toBeInTheDocument();
  });

  it('shows skill list items', () => {
    renderModal();
    fireEvent.click(screen.getByText('Skills'));
    expect(screen.getByText('skill1')).toBeInTheDocument();
  });

  it('calls onClose when overlay clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('workstation.agentManage').closest('.modal-overlay')!);
    expect(props.onClose).toHaveBeenCalled();
  });
});
