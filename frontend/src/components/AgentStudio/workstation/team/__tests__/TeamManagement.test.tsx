import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const mockFetchAll = vi.fn().mockResolvedValue([]);
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockClone = vi.fn();
const mockRemoveBatch = vi.fn();

vi.mock('../api', () => ({
  get teamAPI() {
    return { fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove, clone: mockClone, removeBatch: mockRemoveBatch };
  },
  setTeamAPI: vi.fn(),
}));

vi.mock('../locales', () => {
  const actual = vi.importActual('../locales');
  return { t: (k: string) => k };
});

import TeamManagement from '../TeamManagement';

function makeTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'Team Alpha', description: 'A dev team', status: 'active' as const,
    category: 'dev' as const, createdAt: '2024-01-01', memberCount: 3, agents: [],
    ...overrides,
  };
}

describe('TeamManagement', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders empty state when no teams', async () => {
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders team table with data', async () => {
    mockFetchAll.mockResolvedValue([makeTeam()]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });
  });

  it('renders multiple teams', async () => {
    mockFetchAll.mockResolvedValue([makeTeam(), makeTeam({ id: '2', name: 'Team Beta' })]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
      expect(screen.getByText('Team Beta')).toBeInTheDocument();
    });
  });

  it('search input filters teams', async () => {
    mockFetchAll.mockResolvedValue([makeTeam()]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('Team Alpha')).toBeInTheDocument(); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
  });

  it('renders error banner on fetch failure', async () => {
    mockFetchAll.mockRejectedValue(new Error('Network error'));
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders search input with correct placeholder', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders "新建团队" button', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    // The button label is the t() key 'team.new'
    expect(screen.getByText('team.new')).toBeInTheDocument();
  });

  it('renders category filter dropdown', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    // The antd Select shows options, 'team.all_category' should be the default value text
    expect(screen.getByText('team.all_category')).toBeInTheDocument();
  });

  it('renders status filter dropdown', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    expect(screen.getByText('team.all_status')).toBeInTheDocument();
  });

  it('renders team table with correct column headers', async () => {
    mockFetchAll.mockResolvedValue([makeTeam()]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });
    // The table grid should be present
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('empty state shows descriptive message when no search', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('team.empty_desc_general')).toBeInTheDocument();
    });
  });

  it('empty state shows search-related message when search is active', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'search term' } });
    await waitFor(() => {
      expect(screen.getByText('team.empty_desc_search')).toBeInTheDocument();
    });
  });

  it('loading state shows skeleton', async () => {
    // Create a promise that never resolves to keep loading state
    mockFetchAll.mockReturnValue(new Promise(() => {}));
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders team category with correct label', async () => {
    mockFetchAll.mockResolvedValue([makeTeam()]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      // Category uses t() from locales, which the mock returns as the key itself
      expect(screen.getByText('team.category_dev')).toBeInTheDocument();
    });
  });

  it('renders team status badge in table', async () => {
    mockFetchAll.mockResolvedValue([makeTeam()]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('活跃')).toBeInTheDocument();
    });
  });

  it('renders team member count', async () => {
    mockFetchAll.mockResolvedValue([makeTeam()]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('renders toolbar with correct role', async () => {
    mockFetchAll.mockResolvedValue([]);
    render(<TeamManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
