import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

vi.mock('../../../../../api/client/teams', () => ({
  listTeams: vi.fn(),
}));

vi.mock('../../../../../api/client', () => ({
  fetchWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

vi.mock('../WorkflowEditor', () => ({
  default: function MockWorkflowEditor({ teamId, agents }: { teamId: string; agents: Array<{ id: string; name: string }> }) {
    return (
      <div data-testid="workflow-editor">
        <span>Editor for team {teamId}</span>
        <span>{agents.length} agents</span>
      </div>
    );
  },
}));

import WorkflowManagement from '../WorkflowManagement';
import { listTeams } from '../../../../../api/client/teams';
import { fetchWorkflow } from '../../../../../api/client';

const mockTeams = [
  {
    id: 'team-1',
    name: 'Team Alpha',
    agents: [
      { id: 'a1', name: 'Agent 1', agentConfigId: 'ac1' },
      { id: 'a2', name: 'Agent 2', agentConfigId: 'ac2' },
    ],
    order: 0,
    is_expanded: false,
    created_at: '2024-01-01',
  },
  {
    id: 'team-2',
    name: 'Team Beta',
    agents: [
      { id: 'a3', name: 'Agent 3', agentConfigId: 'ac3' },
    ],
    order: 1,
    is_expanded: false,
    created_at: '2024-01-02',
  },
];

describe('WorkflowManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTeams).mockResolvedValue(mockTeams as never);
    vi.mocked(fetchWorkflow).mockResolvedValue(null);
  });

  it('renders the management component', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    expect(screen.getByText('选择团队')).toBeInTheDocument();
    expect(screen.getByText('选择一个团队开始编排工作流')).toBeInTheDocument();
  });

  it('shows empty state when no team is selected', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    expect(screen.getByText('选择一个团队开始编排工作流')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-editor')).not.toBeInTheDocument();
  });

  it('loads teams and shows them in the dropdown', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team Beta')).toBeInTheDocument();
    });
  });

  it('renders workflow editor when a team is selected', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'team-1' } });

    await waitFor(() => {
      expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
      expect(screen.getByText('Editor for team team-1')).toBeInTheDocument();
    });
  });

  it('fetches workflow config when team is selected', async () => {
    const mockConfig = {
      id: 'wf-1',
      teamId: 'team-1',
      name: 'My Workflow',
      maxRounds: 3,
      nodes: [],
      edges: [],
    };
    vi.mocked(fetchWorkflow).mockResolvedValue(mockConfig);

    render(<WorkflowManagement />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'team-1' } });

    await waitFor(() => {
      expect(fetchWorkflow).toHaveBeenCalledWith('team-1');
    });
  });

  it('handles listTeams error gracefully', async () => {
    vi.mocked(listTeams).mockRejectedValue(new Error('Network error'));

    render(<WorkflowManagement />, { wrapper: TestProviders });

    await waitFor(() => {
      expect(screen.getByText('选择团队')).toBeInTheDocument();
    });

    expect(screen.getByText('选择一个团队开始编排工作流')).toBeInTheDocument();
  });
});
