import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VirtuosoMockContext } from 'react-virtuoso';
import LogAudit from '../LogAudit';
import { fetchCommandLogs } from '../../../../../api/client/admin';
import { t } from '../locales';

vi.mock('../../../../../api/client/admin', () => ({
  fetchCommandLogs: vi.fn(),
}));

vi.mock('../locales', () => ({
  t: (k: string) => k,
  setLang: vi.fn(),
  getLang: () => 'en',
}));

const mockLogs = [
  { id: '1', timestamp: '2025-01-01T10:00:00', command: 'create agent', payload: 'test payload', result: 'success' },
  { id: '2', timestamp: '2025-01-01T10:05:00', command: 'delete prompt', payload: 'payload2', result: 'deleted' },
  { id: '3', timestamp: '2025-01-01T10:10:00', command: 'run tool', payload: 'payload3', result: 'done' },
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

describe('LogAudit', () => {
  it('renders loading skeleton initially', () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderWithVirtuoso(<LogAudit />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no logs returned', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('renders log entries in table', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('create agent')).toBeInTheDocument();
    expect(screen.getByText('delete prompt')).toBeInTheDocument();
    expect(screen.getByText('run tool')).toBeInTheDocument();
  });

  it('renders table column headers', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
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
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
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
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('deleted')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });

  it('filters logs by search text', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    expect(screen.getByText('create agent')).toBeInTheDocument();
    expect(screen.getByText('run tool')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(t('logs.search_placeholder'));
    fireEvent.change(searchInput, { target: { value: 'delete' } });

    await waitFor(() => {
      expect(screen.queryByText('create agent')).not.toBeInTheDocument();
    });
    expect(screen.getByText('delete prompt')).toBeInTheDocument();
    expect(screen.queryByText('run tool')).not.toBeInTheDocument();
  });

  it('shows pagination controls when logs exceed page size', async () => {
    const manyLogs = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      timestamp: `2025-01-01T10:${String(i).padStart(2, '0')}:00`,
      command: `command ${i + 1}`,
      payload: `payload${i + 1}`,
      result: `result${i + 1}`,
    }));
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(manyLogs);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(document.querySelector('.wsta-pagination')).toBeInTheDocument();
  });

  it('renders level filter select', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    const selects = document.querySelectorAll('.ant-select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders toolbar with toolbar role', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('renders region with aria-label', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    const { container } = renderWithVirtuoso(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    const region = container.querySelector('[role="region"]');
    expect(region).toBeInTheDocument();
  });
});
