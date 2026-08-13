import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { VirtuosoMockContext } from 'react-virtuoso';
import LogAudit from '../LogAudit';
import { fetchCommandLogs } from '../../../../../api/client/admin';
import { t } from '../locales';
import type * as React from 'react';

vi.mock('../../../../../api/client/admin', () => ({
  fetchCommandLogs: vi.fn(),
}));

vi.mock('../locales', () => ({
  t: (k: string) => k,
  setLang: vi.fn(),
  getLang: () => 'en',
}));

const mockLogs = [
  { id: '1', timestamp: '2025-01-01T10:00:00', action: 'create', entity_type: 'agent', entity_name: '研究员', detail: '创建成功', user: 'admin', ip: '127.0.0.1' },
  { id: '2', timestamp: '2025-01-01T10:05:00', action: 'delete', entity_type: 'prompt', entity_name: '旧模板', detail: '删除成功', user: 'admin', ip: '127.0.0.1' },
  { id: '3', timestamp: '2025-01-01T10:10:00', action: 'update', entity_type: 'tool', entity_name: '搜索工具', detail: '更新成功', user: 'admin', ip: '127.0.0.1' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

const renderWithVirtuoso = (ui: React.ReactElement) =>
  render(
    <VirtuosoMockContext.Provider value={{ viewportHeight: 800, itemHeight: 50 }}>
      {ui}
    </VirtuosoMockContext.Provider>,
  );

describe('LogAudit', { tags: ['integration'] }, () => {
  it('renders loading skeleton initially', () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderWithVirtuoso(<LogAudit />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no logs returned', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('renders log entries in table', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.getByText('update')).toBeInTheDocument();
  });

  it('renders table column headers', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t('logs.col_time'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_level'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_module'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_user'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_action'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_details'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_ip'))).toBeInTheDocument();
  });

  it('renders toolbar with search input', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(t('logs.search_placeholder'))).toBeInTheDocument();
  });

  it('handles API error gracefully by showing empty state', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('shows details and IP columns for log entries', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText('研究员 — 创建成功')).toBeInTheDocument();
    expect(screen.getByText('旧模板 — 删除成功')).toBeInTheDocument();
    expect(screen.getByText('搜索工具 — 更新成功')).toBeInTheDocument();
  });

  it('filters logs by search text', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('update')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(t('logs.search_placeholder'));
    fireEvent.change(searchInput, { target: { value: 'delete' } });

    await waitFor(() => {
      expect(screen.queryByText('create')).not.toBeInTheDocument();
    });
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.queryByText('update')).not.toBeInTheDocument();
  });

  it('shows pagination controls when logs exceed page size', async () => {
    const manyLogs = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      timestamp: `2025-01-01T10:${String(i).padStart(2, '0')}:00`,
      action: 'update',
      entity_type: 'agent',
      entity_name: `Agent ${i + 1}`,
      detail: '更新成功',
      user: 'admin',
      ip: '127.0.0.1',
    }));
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: manyLogs, total: manyLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/共 \d+ 条/)).toBeInTheDocument();
  });

  it('renders level filter select', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const selects = document.querySelectorAll('.ant-select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders toolbar with toolbar role', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('renders region with aria-label', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items: mockLogs, total: mockLogs.length, offset: 0, limit: 200 });
    const { container } = renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    const region = container.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
  });
});
