import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkstationPage from '../WorkstationPage';
import { TestProviders } from '../../../test/setup';

const { mockTeamsTab, mockPromptsTab, mockOutputTab } = vi.hoisted(() => ({
  mockTeamsTab: vi.fn(() => <div data-testid="teams-tab">Teams</div>),
  mockPromptsTab: vi.fn(() => <div data-testid="prompts-tab">Prompts</div>),
  mockOutputTab: vi.fn(() => <div data-testid="output-tab">Output</div>),
}));

vi.mock('../workstation/tabConfig', () => ({
  navGroups: [
    {
      label: '管理',
      tabs: [
        { id: 'teams', label: '团队管理', icon: () => <span>TeamIcon</span> },
        { id: 'prompts', label: '提示词', icon: () => <span>PromptIcon</span> },
        { id: 'output', label: '输出约束', icon: () => <span>OutputIcon</span> },
      ],
    },
  ],
  TAB_RENDERERS: {
    teams: mockTeamsTab,
    prompts: mockPromptsTab,
    output: mockOutputTab,
  },
}));

vi.mock('lucide-react', () => ({
  RefreshCw: () => <span>Refresh</span>,
}));

describe('WorkstationPage', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar with groups and tabs', () => {
    render(
      <TestProviders>
        <WorkstationPage />
      </TestProviders>,
    );

    expect(screen.getByText('管理工作台')).toBeInTheDocument();
    expect(screen.getByText('管理')).toBeInTheDocument();
    expect(screen.getAllByText('团队管理').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('提示词')).toBeInTheDocument();
    expect(screen.getByText('输出约束')).toBeInTheDocument();
  });

  it('renders default tab (teams) content', () => {
    render(
      <TestProviders>
        <WorkstationPage />
      </TestProviders>,
    );

    expect(screen.getByTestId('teams-tab')).toBeInTheDocument();
    expect(mockTeamsTab).toHaveBeenCalled();
  });

  it('switches tab content when clicking different tab', () => {
    render(
      <TestProviders>
        <WorkstationPage />
      </TestProviders>,
    );

    fireEvent.click(screen.getByText('提示词'));
    expect(screen.getByTestId('prompts-tab')).toBeInTheDocument();
    expect(mockPromptsTab).toHaveBeenCalled();

    fireEvent.click(screen.getByText('输出约束'));
    expect(screen.getByTestId('output-tab')).toBeInTheDocument();
    expect(mockOutputTab).toHaveBeenCalled();
  });

  it('shows active tab with different style', () => {
    render(
      <TestProviders>
        <WorkstationPage />
      </TestProviders>,
    );

    const teamsTabBtns = screen.getAllByText('团队管理');
    const sidebarBtn = teamsTabBtns[0].closest('button');
    expect(sidebarBtn).toHaveStyle({
      color: 'var(--da-accent)',
    });
  });

  it('tab renderer receives onNavigate callback', () => {
    render(
      <TestProviders>
        <WorkstationPage />
      </TestProviders>,
    );

    expect(mockTeamsTab).toHaveBeenCalledWith(
      expect.objectContaining({
        onNavigate: expect.any(Function),
      }),
    );
  });
});
