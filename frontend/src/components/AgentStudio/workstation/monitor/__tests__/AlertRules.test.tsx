import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const mockFetch = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/api/client/alerts', () => ({
  METRIC_TYPES: ['success_rate', 'p95_latency', 'avg_latency', 'daily_cost', 'error_count'],
  fetchAlertRules: (...a: unknown[]) => mockFetch(...a),
  createAlertRule: (...a: unknown[]) => mockCreate(...a),
  updateAlertRule: (...a: unknown[]) => mockUpdate(...a),
  deleteAlertRule: (...a: unknown[]) => mockDelete(...a),
  silenceAlertRule: vi.fn(),
  fetchAlertEvents: vi.fn(),
  ackAlertEvent: vi.fn(),
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  fetchUnreadCount: vi.fn(),
  fetchSubscriptions: vi.fn(),
  replaceSubscriptions: vi.fn(),
}));

import { TestProviders } from '../../../../../test/setup';
import { AlertRules } from '../AlertRules';

const RULES = [
  {
    id: 'r1', name: '成功率下限', metricType: 'success_rate', operator: 'lt',
    threshold: 95, windowSeconds: 3600, severity: 'P1', runbookUrl: null,
    cooldownSeconds: 300, silenceUntil: null, teamId: null, enabled: true,
    createdBy: 'admin', createdAt: '2026-08-19T00:00:00Z', updatedAt: '2026-08-19T00:00:00Z',
  },
];

describe('AlertRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(RULES);
  });

  it('renders rules after load', async () => {
    render(<TestProviders><AlertRules /></TestProviders>);

    expect(await screen.findByText('成功率下限')).toBeInTheDocument();
    expect(screen.getByText('新建规则')).toBeInTheDocument();
    expect(screen.getByText('P1(紧急)')).toBeInTheDocument();
  });

  it('creates a new rule through the form', async () => {
    mockCreate.mockResolvedValue({ ...RULES[0], id: 'r2' });
    render(<TestProviders><AlertRules /></TestProviders>);
    await screen.findByText('成功率下限');

    fireEvent.click(screen.getByText('新建规则'));
    expect(await screen.findByText('保存')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('规则名称'), { target: { value: '错误突增' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.name).toBe('错误突增');
    expect(payload.metricType).toBe('success_rate');
  });

  it('toggles rule enabled state', async () => {
    mockUpdate.mockResolvedValue(RULES[0]);
    render(<TestProviders><AlertRules /></TestProviders>);
    await screen.findByText('成功率下限');

    const switchBtn = screen.getAllByRole('switch')[0];
    fireEvent.click(switchBtn);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('r1', { enabled: false }));
  });

  it('deletes a rule', async () => {
    mockDelete.mockResolvedValue(undefined);
    render(<TestProviders><AlertRules /></TestProviders>);
    await screen.findByText('成功率下限');

    fireEvent.click(screen.getByTitle('删除'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('r1'));
  });
});