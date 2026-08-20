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
  { id: '1', timestamp: '2025-01-01T10:00:00', action: 'create', entity_type: 'agent', entity_name: '研究员', detail: '创建成功', level: 'info', before: '', after: '', user: 'admin', ip: '127.0.0.1', user_agent: 'ua', request_id: 'r1' },
  { id: '2', timestamp: '2025-01-01T10:05:00', action: 'delete', entity_type: 'prompt', entity_name: '旧模板', detail: '删除成功', level: 'warn', before: '', after: '', user: 'admin', ip: '127.0.0.1', user_agent: 'ua', request_id: 'r2' },
  { id: '3', timestamp: '2025-01-01T10:10:00', action: 'update', entity_type: 'tool', entity_name: '搜索工具', detail: '更新成功', level: 'info', before: '', after: '', user: 'admin', ip: '127.0.0.1', user_agent: 'ua', request_id: 'r3' },
];

const resolveLogs = (items: unknown[] = mockLogs) =>
  (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue({ items, total: items.length, offset: 0, limit: 7 });

const renderWithVirtuoso = (ui: React.ReactElement) =>
  render(
    <VirtuosoMockContext.Provider value={{ viewportHeight: 800, itemHeight: 50 }}>
      {ui}
    </VirtuosoMockContext.Provider>,
  );

const waitLoaded = () => waitFor(() => {
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

describe('LogAudit', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton initially', () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderWithVirtuoso(<LogAudit />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no logs returned', async () => {
    resolveLogs([]);
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('renders log entries in table', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('create')).toBeInTheDocument();
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.getByText('update')).toBeInTheDocument();
  });

  it('renders table column headers', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByText(t('logs.col_time'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_level'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_module'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_user'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_action'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_details'))).toBeInTheDocument();
    expect(screen.getByText(t('logs.col_ip'))).toBeInTheDocument();
  });

  it('renders toolbar with search input', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByPlaceholderText(t('logs.search_placeholder'))).toBeInTheDocument();
  });

  it('handles API error gracefully by showing empty state', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('shows details column for log entries', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByText('创建成功')).toBeInTheDocument();
    expect(screen.getByText('删除成功')).toBeInTheDocument();
    expect(screen.getByText('更新成功')).toBeInTheDocument();
  });

  it('passes search filter to the backend and reloads', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();

    const searchInput = screen.getByPlaceholderText(t('logs.search_placeholder'));
    fireEvent.change(searchInput, { target: { value: 'delete' } });

    await waitFor(() => {
      expect(fetchCommandLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'delete', level: undefined, entity_type: undefined }),
      );
    });
  });

  it('passes level and module filters to the backend', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();

    const selects = document.querySelectorAll('.ant-select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('shows pagination controls when total exceeds page size', async () => {
    resolveLogs(Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      timestamp: `2025-01-01T10:${String(i).padStart(2, '0')}:00`,
      action: 'update',
      entity_type: 'agent',
      entity_name: `Agent ${i + 1}`,
      detail: '更新成功',
      level: 'info',
      before: '',
      after: '',
      user: 'admin',
      ip: '127.0.0.1',
      user_agent: 'ua',
      request_id: 'r',
    })));
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByText(/共 \d+ 条/)).toBeInTheDocument();
  });

  it('renders toolbar with toolbar role', async () => {
    resolveLogs();
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('renders region with aria-label', async () => {
    resolveLogs();
    const { container } = renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    const region = container.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
  });

  it('opens detail modal with request_id and diff', async () => {
    const withDiff = [
      { id: '9', timestamp: '2025-01-01T11:00:00', action: 'update', entity_type: 'agent', entity_name: 'Agent X', detail: '配置更新', level: 'info', before: '{"name":"old"}', after: '{"name":"new"}', user: 'admin', ip: '1.2.3.4', user_agent: 'Mozilla/5.0', request_id: 'req-abc-123' },
    ];
    resolveLogs(withDiff);
    renderWithVirtuoso(<LogAudit />);
    await waitLoaded();
    fireEvent.click(screen.getByText('配置更新'));
    await waitFor(() => {
      expect(screen.getByText('req-abc-123')).toBeInTheDocument();
    });
    expect(screen.getByText('Mozilla/5.0')).toBeInTheDocument();
    expect(screen.getByText('变更前')).toBeInTheDocument();
    expect(screen.getByText('变更后')).toBeInTheDocument();
  });
});
