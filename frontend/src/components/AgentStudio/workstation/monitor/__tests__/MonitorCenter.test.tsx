import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../locales', () => ({ t: (key: string) => key }));

vi.mock('../../../../api/client/admin', () => ({
  fetchDashboardStats: () => Promise.resolve({ agents: 5, prompts: 3, tools: 2, mcps: 1, skills: 4, teams: 2, logs_today: 10, updated_at: '2024-01-01T00:00:00Z' }),
  fetchRecentActivity: () => Promise.resolve([{ id: '1', action: 'create', entity_type: 'agent', entity_name: 'Test Agent', detail: '', timestamp: '2024-01-01T12:00:00Z' }]),
  fetchSystemHealth: () => Promise.resolve({ status: 'ok', database: 'connected', redis: 'connected' }),
}));

vi.mock('../MonitorActivity', () => ({ default: () => <div data-testid="monitor-activity" /> }));
vi.mock('../MonitorHealth', () => ({ default: () => <div data-testid="monitor-health" /> }));
vi.mock('../MonitorStats', () => ({ default: () => <div data-testid="monitor-stats" /> }));

import MonitorCenter from '../MonitorCenter';

describe('MonitorCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard content after data loads', async () => {
    render(<MonitorCenter onNavigate={vi.fn()} />);

    expect(await screen.findByText('刷新')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-stats')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-activity')).toBeInTheDocument();
    expect(screen.getByTestId('monitor-health')).toBeInTheDocument();
    expect(screen.getByText(/上次更新/)).toBeInTheDocument();
  });

  it('passes onNavigate through to MonitorStats', async () => {
    render(<MonitorCenter onNavigate={vi.fn()} />);

    expect(await screen.findByTestId('monitor-stats')).toBeInTheDocument();
  });

  it('does not crash when onNavigate is omitted', async () => {
    render(<MonitorCenter />);

    expect(await screen.findByText('刷新')).toBeInTheDocument();
  });
});
