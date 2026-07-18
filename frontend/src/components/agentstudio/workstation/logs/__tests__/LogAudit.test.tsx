import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('LogAudit', () => {
  it('renders loading skeleton initially', () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<LogAudit />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders empty state when no logs returned', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('renders log entries in table', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    render(<LogAudit />);
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
    render(<LogAudit />);
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
    render(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(t('logs.search_placeholder'))).toBeInTheDocument();
  });

  it('handles API error gracefully by showing empty state', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'));
    render(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText(t('logs.empty'))).toBeInTheDocument();
  });

  it('shows details and IP columns for log entries', async () => {
    (fetchCommandLogs as ReturnType<typeof vi.fn>).mockResolvedValue(mockLogs);
    render(<LogAudit />);
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('deleted')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();
  });
});
