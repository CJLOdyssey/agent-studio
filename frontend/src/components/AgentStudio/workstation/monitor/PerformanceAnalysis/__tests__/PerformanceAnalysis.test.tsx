import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import { PerformanceAnalysis } from '../index';
import * as costApi from '../../../../../../api/client/cost';

vi.mock('../../../../../../api/client/cost');
const mockFetchPerformanceSummary = vi.mocked(costApi.fetchPerformanceSummary);
const mockFetchPerformanceTrend = vi.mocked(costApi.fetchPerformanceTrend);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PerformanceAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockFetchPerformanceSummary.mockReturnValue(new Promise(() => {}));
    mockFetchPerformanceTrend.mockReturnValue(new Promise(() => {}));

    render(<PerformanceAnalysis />, { wrapper: createWrapper() });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render error state when API fails', async () => {
    mockFetchPerformanceSummary.mockRejectedValue(new Error('API Error'));
    mockFetchPerformanceTrend.mockRejectedValue(new Error('API Error'));

    render(<PerformanceAnalysis />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('should render performance data when API succeeds', async () => {
    mockFetchPerformanceSummary.mockResolvedValue({
      period_days: 7,
      avg_response_time_s: 1.5,
      avg_success_rate: 98.5,
      avg_tokens_per_call: 1200,
      total_calls: 150,
    });

    mockFetchPerformanceTrend.mockResolvedValue([
      {
        time_bucket: '2024-01-01',
        avg_response_time_s: 1.2,
        success_rate: 99.0,
        calls: 20,
        avg_tokens: 1100,
      },
    ]);

    render(<PerformanceAnalysis />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('1.50s')).toBeInTheDocument();
    });
  });

  it('should render performance summary cards', async () => {
    mockFetchPerformanceSummary.mockResolvedValue({
      period_days: 7,
      avg_response_time_s: 1.5,
      avg_success_rate: 98.5,
      avg_tokens_per_call: 1200,
      total_calls: 150,
    });

    mockFetchPerformanceTrend.mockResolvedValue([]);

    render(<PerformanceAnalysis />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('平均响应时间')).toBeInTheDocument();
    });
  });

  it('should refetch when retry button is clicked', async () => {
    mockFetchPerformanceSummary.mockRejectedValueOnce(new Error('API Error'));
    mockFetchPerformanceTrend.mockRejectedValueOnce(new Error('API Error'));

    const user = userEvent.setup();
    render(<PerformanceAnalysis />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /重试/i })).toBeInTheDocument();
    });

    mockFetchPerformanceSummary.mockResolvedValue({
      period_days: 7,
      avg_response_time_s: 1.5,
      avg_success_rate: 98.5,
      avg_tokens_per_call: 1200,
      total_calls: 150,
    });
    mockFetchPerformanceTrend.mockResolvedValue([]);

    await user.click(screen.getByRole('button', { name: /重试/i }));

    await waitFor(() => {
      expect(mockFetchPerformanceSummary).toHaveBeenCalledTimes(2);
    });
  });
});
