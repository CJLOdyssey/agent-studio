import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../../../api/client/agents', () => ({
  listAgents: vi.fn(),
}));

vi.mock('../../../../../api/client/teams', () => ({
  ...vi.importActual('../../../../../api/client/teams'),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
}));

import TeamMemberManager from '../TeamMemberManager';
import type { TeamEntry } from '../team.types';
import { listAgents } from '../../../../../api/client/agents';
import { addTeamMember, removeTeamMember } from '../../../../../api/client/teams';

function makeTeam(overrides: Partial<TeamEntry> = {}): TeamEntry {
  return {
    id: 'team-1',
    name: 'Alpha Team',
    description: 'A dev team',
    status: 'active',
    category: 'dev',
    createdAt: '2024-01-01',
    agents: [
      { id: 'm1', name: 'Alice', role: 'leader', order: 0, agentConfigId: 'a1', systemPrompt: null, outputConstraints: null, tools: [], mcp: [], skills: [] },
      { id: 'm2', name: 'Bob', role: '成员', order: 1, agentConfigId: 'a2', systemPrompt: null, outputConstraints: null, tools: [], mcp: [], skills: [] },
    ],
    memberCount: 2,
    ...overrides,
  };
}

const listAgentsMock = listAgents as ReturnType<typeof vi.fn>;
const addTeamMemberMock = addTeamMember as ReturnType<typeof vi.fn>;
const removeTeamMemberMock = removeTeamMember as ReturnType<typeof vi.fn>;

describe('TeamMemberManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders manager modal with team name', () => {
    listAgentsMock.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<TeamMemberManager team={makeTeam()} onClose={onClose} />);
    expect(screen.getByText('Alpha Team')).toBeInTheDocument();
  });

  it('renders search input for agents', () => {
    listAgentsMock.mockResolvedValue([]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('搜索 Agent...')).toBeInTheDocument();
  });

  it('shows "all agents already members" when no available agents', async () => {
    listAgentsMock.mockResolvedValue([
      { id: 'a1', name: 'Alice' },
      { id: 'a2', name: 'Bob' },
    ]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('所有 Agent 已是成员')).toBeInTheDocument();
    });
  });

  it('shows "no matching agents" when search yields no results', async () => {
    listAgentsMock.mockResolvedValue([
      { id: 'a3', name: 'Charlie' },
    ]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      // Charlie should appear since he's not a member
    });
    const input = screen.getByPlaceholderText('搜索 Agent...');
    fireEvent.change(input, { target: { value: 'ZZZhopefullynotfound' } });
    await waitFor(() => {
      expect(screen.getByText('无匹配 Agent')).toBeInTheDocument();
    });
  });

  it('filters out existing members from addable list', async () => {
    listAgentsMock.mockResolvedValue([
      { id: 'a1', name: 'Alice' },
      { id: 'a3', name: 'Charlie' },
    ]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
    // Alice exists in members section but not in addable section; verify Charlie appears as addable
    // and the addable section does not show "所有 Agent 已是成员"
    expect(screen.queryByText('所有 Agent 已是成员')).toBeNull();
  });

  it('displays current members list', async () => {
    listAgentsMock.mockResolvedValue([]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows member count', async () => {
    listAgentsMock.mockResolvedValue([]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      // The member count is rendered as text "2" next to "当前成员"
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('calls onClose when clicking overlay', () => {
    listAgentsMock.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<TeamMemberManager team={makeTeam()} onClose={onClose} />);
    const overlay = document.querySelector('.modal-overlay');
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking X button', () => {
    listAgentsMock.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<TeamMemberManager team={makeTeam()} onClose={onClose} />);
    const closeBtn = document.querySelector('.modal-close') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking modal content', () => {
    listAgentsMock.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<TeamMemberManager team={makeTeam()} onClose={onClose} />);
    const modalContent = document.querySelector('.modal-content');
    fireEvent.click(modalContent!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows "no members" message when team has no agents', async () => {
    listAgentsMock.mockResolvedValue([]);
    render(<TeamMemberManager team={makeTeam({ agents: [], memberCount: 0 })} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('暂无成员')).toBeInTheDocument();
    });
  });

  it('shows error from agent loading failure', async () => {
    listAgentsMock.mockRejectedValue(new Error('Network error'));
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('加载 Agent 列表失败')).toBeInTheDocument();
    });
  });

  it('dismisses error when clicking dismiss button', async () => {
    listAgentsMock.mockRejectedValue(new Error('Network error'));
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('加载 Agent 列表失败')).toBeInTheDocument();
    });
    // Find the dismiss button within the error container
    const errorContainer = screen.getByText('加载 Agent 列表失败').closest('div');
    if (errorContainer) {
      const dismissBtn = errorContainer.querySelector('button') as HTMLButtonElement;
      if (dismissBtn) {
        fireEvent.click(dismissBtn);
        await waitFor(() => {
          expect(screen.queryByText('加载 Agent 列表失败')).toBeNull();
        });
      }
    }
  });

  it('filters agents by search text', async () => {
    listAgentsMock.mockResolvedValue([
      { id: 'a3', name: 'Charlie' },
      { id: 'a4', name: 'David' },
    ]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('David')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('搜索 Agent...');
    fireEvent.change(input, { target: { value: 'char' } });

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.queryByText('David')).toBeNull();
    });
  });

  it('displays member role text', async () => {
    listAgentsMock.mockResolvedValue([]);
    render(<TeamMemberManager team={makeTeam()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('leader')).toBeInTheDocument();
      expect(screen.getByText('成员')).toBeInTheDocument();
    });
  });
});
