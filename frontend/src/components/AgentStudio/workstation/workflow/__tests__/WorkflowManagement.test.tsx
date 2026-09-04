import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

vi.mock('../../../../../api/client/teams', () => ({
  listTeams: vi.fn(),
}));

vi.mock('../../../../../api/client', () => ({
  listWorkflows: vi.fn(),
  fetchWorkflow: vi.fn(),
  saveWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

vi.mock('../WorkflowEditor', () => ({
  default: function MockWorkflowEditor({ teamId, agents, onDirtyChange }: {
    teamId: string;
    agents: Array<{ id: string; name: string }>;
    onDirtyChange?: (dirty: boolean) => void;
  }) {
    return (
      <div data-testid="workflow-editor">
        <span>Editor for team {teamId}</span>
        <span>{agents.length} agents</span>
        <button onClick={() => onDirtyChange?.(true)}>mark-dirty</button>
      </div>
    );
  },
}));

import WorkflowManagement from '../WorkflowManagement';
import { listTeams } from '../../../../../api/client/teams';
import { listWorkflows, fetchWorkflow } from '../../../../../api/client';

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

const mockWorkflows = [
  { id: 'wf-1', teamId: 'team-1', teamName: 'Team Alpha', name: '审批流', nodeCount: 5, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'wf-2', teamId: 'team-2', teamName: 'Team Beta', name: '生成流', nodeCount: 3, createdAt: '2024-01-02T00:00:00Z' },
];

describe('WorkflowManagement', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listTeams).mockResolvedValue(mockTeams as never);
    vi.mocked(listWorkflows).mockResolvedValue(mockWorkflows as never);
    vi.mocked(fetchWorkflow).mockResolvedValue(null);
  });

  it('renders the workflow list by default', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(listWorkflows).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
      expect(screen.getByText('生成流')).toBeInTheDocument();
    });
  });

  it('shows the team column from the list data', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team Beta')).toBeInTheDocument();
    });
  });

  it('shows the node count column', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('opens the editor when a workflow row is clicked', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('审批流'));
    await waitFor(() => {
      expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
      expect(screen.getByText('Editor for team team-1')).toBeInTheDocument();
    });
  });

  it('fetches the workflow config for the selected team', async () => {
    const mockConfig = {
      id: 'wf-1',
      teamId: 'team-1',
      name: '审批流',
      maxRounds: 3,
      nodes: [],
      edges: [],
    };
    vi.mocked(fetchWorkflow).mockResolvedValue(mockConfig);

    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('审批流'));
    await waitFor(() => {
      expect(fetchWorkflow).toHaveBeenCalledWith('team-1');
    });
  });

  it('returns to the list via the back button', async () => {
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('审批流'));
    await waitFor(() => {
      expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('返回列表'));
    await waitFor(() => {
      expect(screen.queryByTestId('workflow-editor')).not.toBeInTheDocument();
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
  });

  it('confirms before leaving the editor with unsaved changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('审批流'));
    await waitFor(() => {
      expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('mark-dirty'));
    fireEvent.click(screen.getByText('返回列表'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByTestId('workflow-editor')).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('返回列表'));
    await waitFor(() => {
      expect(screen.queryByTestId('workflow-editor')).not.toBeInTheDocument();
    });
    confirmSpy.mockRestore();
  });

  it('handles listWorkflows error gracefully', async () => {
    vi.mocked(listWorkflows).mockRejectedValue(new Error('Network error'));
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('handles listTeams error gracefully', async () => {
    vi.mocked(listTeams).mockRejectedValue(new Error('Network error'));
    render(<WorkflowManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
  });
});
