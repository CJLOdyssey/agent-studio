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
  mcpAPI: {
    fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove,
    clone: mockClone, removeBatch: mockRemoveBatch,
  },
}));

import MCPManagement from '../MCPManagement';
import { formatDateTime } from '../../../../../utils/formatDateTime';

function makeMCP(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'File Server', description: 'MCP file server', type: 'sse' as const,
    status: 'connected' as const, enabled: true, version: 'v1.0.0', command: '', url: 'http://localhost:3000',
    args: [], env: [], createdAt: '2024-01-01T00:00:00Z', ...overrides,
  };
}

describe('MCPManagement', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAll.mockResolvedValue([]);
  });

  it('renders empty state when no MCPs', async () => {
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByRole('region')).toBeInTheDocument();
    });
  });

  it('renders MCP table with data', async () => {
    mockFetchAll.mockResolvedValue([makeMCP()]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('File Server')).toBeInTheDocument();
    });
  });

  it('renders multiple MCPs', async () => {
    mockFetchAll.mockResolvedValue([makeMCP(), makeMCP({ id: '2', name: 'DB Server' })]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('File Server')).toBeInTheDocument();
      expect(screen.getByText('DB Server')).toBeInTheDocument();
    });
  });

  it('search input changes', async () => {
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => { screen.getByRole('textbox'); });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'file' } });
  });

  it('renders with stdio type MCP', async () => {
    mockFetchAll.mockResolvedValue([makeMCP({ type: 'stdio', command: 'npx server', url: '' })]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('File Server')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton while fetching', () => {
    mockFetchAll.mockReturnValue(new Promise(() => {}));
    render(<MCPManagement />, { wrapper: TestProviders });
    const statusElements = screen.getAllByRole('status');
    expect(statusElements.length).toBeGreaterThanOrEqual(1);
  });

  it('selects a row checkbox', async () => {
    mockFetchAll.mockResolvedValue([makeMCP(), makeMCP({ id: '2', name: 'DB Server' })]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('File Server')).toBeInTheDocument(); });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).toBeChecked();
    expect(screen.getByText('批量删除 (1)')).toBeInTheDocument();
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).not.toBeChecked();
    expect(screen.queryByText('批量删除 (1)')).not.toBeInTheDocument();
  });

  it('renders connected status badge', async () => {
    mockFetchAll.mockResolvedValue([makeMCP()]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('已连接')).toBeInTheDocument();
    });
  });

  it('renders disconnected status badge', async () => {
    mockFetchAll.mockResolvedValue([makeMCP({ status: 'disconnected' })]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('未连接')).toBeInTheDocument();
    });
  });

  it('renders sse type badge', async () => {
    mockFetchAll.mockResolvedValue([makeMCP()]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('SSE')).toBeInTheDocument();
    });
  });

  it('renders createdAt column with absolute datetime', async () => {
    mockFetchAll.mockResolvedValue([makeMCP()]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => {
      expect(screen.getByText('创建时间')).toBeInTheDocument();
    });
    expect(screen.getByText(formatDateTime('2024-01-01T00:00:00Z'))).toBeInTheDocument();
  });
});
