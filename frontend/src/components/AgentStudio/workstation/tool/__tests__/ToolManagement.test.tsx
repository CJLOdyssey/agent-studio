import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const { mockFetchAll, mockCreate, mockUpdate, mockRemove, mockClone, mockRemoveBatch } = vi.hoisted(() => ({
  mockFetchAll: vi.fn().mockResolvedValue([]),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockRemove: vi.fn(),
  mockClone: vi.fn(),
  mockRemoveBatch: vi.fn(),
}));

vi.mock('../api', () => ({
  toolAPI: {
    fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove,
    clone: mockClone, removeBatch: mockRemoveBatch,
  },
}));

import ToolManagement from '../ToolManagement';

function makeTool(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'Search Tool', description: 'A search tool', category: '内置工具',
    status: 'active' as const, version: 'v1.0.0', endpoint: '', parameters: '{}',
    createdAt: '2024-01-01', ...overrides,
  };
}

describe('ToolManagement', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders empty state when no tools', async () => {
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders tool table with data', async () => {
    mockFetchAll.mockResolvedValue([makeTool()]);
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Search Tool')).toBeInTheDocument();
    });
  });

  it('renders multiple tools', async () => {
    mockFetchAll.mockResolvedValue([makeTool(), makeTool({ id: '2', name: 'Write Tool' })]);
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Search Tool')).toBeInTheDocument();
      expect(screen.getByText('Write Tool')).toBeInTheDocument();
    });
  });

  it('search input changes', async () => {
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => { screen.getByRole('textbox'); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'search' } });
  });

  it('renders with disabled tool', async () => {
    mockFetchAll.mockResolvedValue([makeTool({ status: 'disabled' })]);
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('Search Tool')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while fetching', () => {
    mockFetchAll.mockReturnValue(new Promise(() => {}));
    render(<ToolManagement />, { wrapper: TestProviders });
    const statusElements = screen.getAllByRole('status');
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
  });

  it('selects a row checkbox', async () => {
    mockFetchAll.mockResolvedValue([makeTool(), makeTool({ id: '2', name: 'Write Tool' })]);
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('Search Tool')).toBeInTheDocument(); });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).toBeChecked();
    expect(screen.getByText('批量删除 (1)')).toBeInTheDocument();
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).not.toBeChecked();
    expect(screen.queryByText('批量删除 (1)')).not.toBeInTheDocument();
  });

  it('renders category badge', async () => {
    mockFetchAll.mockResolvedValue([makeTool()]);
    render(<ToolManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('内置工具')).toBeInTheDocument();
    });
  });
});
