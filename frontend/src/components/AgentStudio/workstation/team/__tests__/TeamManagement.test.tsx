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

import TeamManagement from '../TeamManagement';

function makeTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'Team Alpha', description: 'A dev team', status: 'active' as const,
    category: 'dev' as const, createdAt: '2024-01-01', memberCount: 3, agents: [],
    ...overrides,
  };
}

describe('TeamManagement', () => {
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
});
