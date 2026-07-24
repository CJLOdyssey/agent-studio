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
  get mcpAPI() {
    return { fetchAll: mockFetchAll, create: mockCreate, update: mockUpdate, remove: mockRemove, clone: mockClone, removeBatch: mockRemoveBatch };
  },
}));

import MCPManagement from '../MCPManagement';

function makeMCP(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: 'File Server', description: 'MCP file server', type: 'sse' as const,
    status: 'connected' as const, version: 'v1.0.0', command: '', url: 'http://localhost:3000',
    createdAt: '2024-01-01', ...overrides,
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
    const { container } = render(<MCPManagement />, { wrapper: TestProviders });
    expect(container.querySelector('.wsta-agent-mgmt')).toBeInTheDocument();
  });

  it('selects a row checkbox', async () => {
    mockFetchAll.mockResolvedValue([makeMCP(), makeMCP({ id: '2', name: 'DB Server' })]);
    render(<MCPManagement />, { wrapper: TestProviders });
    await waitFor(() => { expect(screen.getByText('File Server')).toBeInTheDocument(); });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(checkboxes[1]);
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
});
