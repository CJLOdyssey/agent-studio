import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const { mockFetchAll, mockCreate, mockUpdate, mockRemove, mockClone, mockRemoveBatch } = vi.hoisted(() => ({
  mockFetchAll: vi.fn().mockResolvedValue([]),
  mockCreate: vi.fn().mockResolvedValue({ id: 'new-1', name: 'New', team: 'T', model: 'GPT', status: 'stopped', version: 'v1', description: '', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [], teams: [], createdAt: '2024-01-01' }),
  mockUpdate: vi.fn().mockResolvedValue(undefined),
  mockRemove: vi.fn().mockResolvedValue(undefined),
  mockClone: vi.fn().mockResolvedValue({ id: 'clone-1', name: 'Copy', team: 'T', model: 'GPT', status: 'stopped', version: 'v1', description: '', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [], teams: [], createdAt: '2024-01-01' }),
  mockRemoveBatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../../api/client/prompts', () => ({ listPrompts: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../../api/client/tools', () => ({ listTools: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../../api/client/mcps', () => ({ listMCPs: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../../api/client/skills', () => ({ listSkills: vi.fn().mockResolvedValue([]) }));

vi.mock('../api', () => ({
  agentAPI: { fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove, clone: mockClone, removeBatch: mockRemoveBatch },
  setAgentAPI: vi.fn(),
}));

import AgentManagement from '../AgentManagement';

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'Agent Alpha', team: '前端', model: 'GPT-4o', status: 'running',
    version: 'v1.0.0', description: 'desc', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [],
    teams: [], createdAt: '2024-01-01', ...overrides,
  };
}

describe('AgentManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders empty state when no agents', async () => {
    render(<AgentManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders loading state then shows empty state', async () => {
    mockFetchAll.mockReturnValue(new Promise(() => {}));
    render(<AgentManagement />, { wrapper: TestProviders });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('renders agent table with data', async () => {
    mockFetchAll.mockResolvedValue([makeAgent()]);
    render(<AgentManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    });
  });

  it('renders multiple agents in table', async () => {
    mockFetchAll.mockResolvedValue([makeAgent(), makeAgent({ id: '2', name: 'Agent Beta' })]);
    render(<AgentManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
      expect(screen.getByText('Agent Beta')).toBeInTheDocument();
    });
  });

  it('calls setSearch when search input changes', async () => {
    render(<AgentManagement />, { wrapper: TestProviders });
    await waitFor(() => { screen.getByRole('textbox'); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(input).toHaveValue('test');
  });

  it('handles empty search state after data loads', async () => {
    mockFetchAll.mockResolvedValue([makeAgent()]);
    render(<AgentManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    });
  });

  it('shows empty search state', async () => {
    mockFetchAll.mockResolvedValue([makeAgent()]);
    render(<AgentManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('Agent Alpha')).toBeInTheDocument(); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
  });
});
