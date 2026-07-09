import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LucideIcon } from 'lucide-react';
import { render, screen, fireEvent } from '@testing-library/react';
import AgentConfigModal from '../AgentConfigModal';
import type { Agent } from '../../../types/agentstudio';

vi.mock('../../../../api/client', () => ({
  promptAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
  outputAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
  toolAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
  mcpAPI: { fetchAll: vi.fn().mockResolvedValue([]) },
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
  return { ...render(<AgentConfigModal {...props} />), props };
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
    expect(screen.getByText('提示词')).toBeInTheDocument();
    expect(screen.getByText('约束')).toBeInTheDocument();
    expect(screen.getByText('工具')).toBeInTheDocument();
    expect(screen.getByText('MCP')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('renders SystemPromptTab by default', () => {
    renderModal();
    expect(screen.getByPlaceholderText('定义该 Agent 的角色、职责和行为规则...')).toBeInTheDocument();
  });

  it('switches to tools tab on click', () => {
    renderModal();
    fireEvent.click(screen.getByText('工具'));
    expect(screen.getByText('工具 (1)')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('约束'));
    expect(screen.getByPlaceholderText('约束 Agent 的输出格式和行为...')).toBeInTheDocument();
  });

  it('calls onClose when Escape pressed', () => {
    const { props } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls onSave when save button clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('保存配置'));
    expect(props.onSave).toHaveBeenCalled();
  });

  it('save button disabled when name is empty', () => {
    renderModal({ agent: { ...mockAgent, name: '' } });
    const saveBtn = screen.getByText('保存配置');
    expect(saveBtn).toBeDisabled();
  });

  it('calls onClose when cancel clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('取消'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('renders modal title with agent name', () => {
    renderModal();
    expect(screen.getByText('配置 Agent')).toBeInTheDocument();
    expect(screen.getByText(/Test Agent/)).toBeInTheDocument();
  });

  it('shows tool list items', () => {
    renderModal();
    fireEvent.click(screen.getByText('工具'));
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
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(props.onClose).toHaveBeenCalled();
  });
});
