import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

vi.mock('../../../../../api/client', () => ({
  listWorkflows: vi.fn(),
  deleteWorkflow: vi.fn(),
}));

import WorkflowList from '../WorkflowList';
import { listWorkflows, deleteWorkflow } from '../../../../../api/client';

const mockWorkflows = [
  { id: 'wf-1', teamId: 'team-1', teamName: 'Team Alpha', name: '审批流', nodeCount: 5, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'wf-2', teamId: 'team-2', teamName: 'Team Beta', name: '生成流', nodeCount: 0, createdAt: '2024-01-02T00:00:00Z' },
];

const mockTeams = [
  { id: 'team-1', name: 'Team Alpha' },
  { id: 'team-2', name: 'Team Beta' },
];

function renderList() {
  return render(
    <WorkflowList
      teams={mockTeams}
      onCreateWorkflow={vi.fn()}
      onOpenWorkflow={vi.fn()}
    />,
    { wrapper: TestProviders },
  );
}

describe('WorkflowList', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listWorkflows).mockResolvedValue(mockWorkflows as never);
    vi.mocked(deleteWorkflow).mockResolvedValue(undefined);
  });

  it('renders workflow rows with node counts', async () => {
    const { container } = renderList();
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
      expect(screen.getByText('生成流')).toBeInTheDocument();
    });
    expect(screen.getAllByText('5')).toHaveLength(1);
    expect(screen.getAllByText('0')).toHaveLength(1);
    expect(container.querySelector('.wsta-badge-dot-green')).toBeDefined();
    expect(container.querySelector('.wsta-badge-dot-gray')).toBeDefined();
  });

  it('opens the workflow when a row is clicked', async () => {
    const onOpenWorkflow = vi.fn();
    render(
      <WorkflowList teams={mockTeams} onCreateWorkflow={vi.fn()} onOpenWorkflow={onOpenWorkflow} />,
      { wrapper: TestProviders },
    );
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('审批流'));
    expect(onOpenWorkflow).toHaveBeenCalledWith({ ...mockWorkflows[0], derivedStatus: 'active' });
  });

  it('filters by search text', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '生成' } });
    await waitFor(() => {
      expect(screen.queryByText('审批流')).not.toBeInTheDocument();
      expect(screen.getByText('生成流')).toBeInTheDocument();
    });
  });

  it('shows empty state when no workflows match', async () => {
    vi.mocked(listWorkflows).mockResolvedValue([] as never);
    renderList();
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('deletes a workflow via the row menu', async () => {
    renderList();
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
    const moreButtons = document.querySelectorAll('.ant-dropdown-trigger');
    fireEvent.click(moreButtons[1] as HTMLElement);
    await waitFor(() => {
      expect(screen.getAllByText('删除').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('删除')[0]);
    await waitFor(() => {
      expect(screen.getAllByText('确认删除').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('确认删除')[1]);
    await waitFor(() => {
      expect(deleteWorkflow).toHaveBeenCalledWith('wf-1');
    });
  });

  it('handles list error and retries', async () => {
    vi.mocked(listWorkflows).mockRejectedValueOnce(new Error('Network error'));
    renderList();
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText('重试'));
    await waitFor(() => {
      expect(screen.getByText('审批流')).toBeInTheDocument();
    });
  });
});
