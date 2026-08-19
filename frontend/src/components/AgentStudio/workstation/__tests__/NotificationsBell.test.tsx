import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockFetchNotifications = vi.fn();
const mockFetchUnreadCount = vi.fn();
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock('@/api/client/alerts', () => ({
  fetchNotifications: (...a: unknown[]) => mockFetchNotifications(...a),
  fetchUnreadCount: (...a: unknown[]) => mockFetchUnreadCount(...a),
  markNotificationRead: (...a: unknown[]) => mockMarkRead(...a),
  markAllNotificationsRead: (...a: unknown[]) => mockMarkAllRead(...a),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

import { TestProviders } from '../../../../test/setup';
import { NotificationsBell } from '../NotificationsBell';

const NOTIFS = [
  { id: 'n1', userId: 'admin', title: '告警 P1', body: '成功率 93%', type: 'alert', link: '/workstation/monitor', readAt: null, createdAt: '2026-08-19T00:00:00Z' },
  { id: 'n2', userId: 'admin', title: '告警 P2', body: '日成本超预算', type: 'alert', link: null, readAt: '2026-08-19T01:00:00Z', createdAt: '2026-08-19T00:00:00Z' },
];

describe('NotificationsBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchNotifications.mockResolvedValue(NOTIFS);
    mockFetchUnreadCount.mockResolvedValue(1);
  });

  it('shows unread badge and opens panel', async () => {
    render(<TestProviders><NotificationsBell /></TestProviders>);

    expect(await screen.findByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(await screen.findByText('告警 P1')).toBeInTheDocument();
    expect(screen.getByText('全部已读')).toBeInTheDocument();
  });

  it('marks one notification read when opened', async () => {
    mockMarkRead.mockResolvedValue({ ...NOTIFS[0], readAt: '2026-08-19T02:00:00Z' });
    render(<TestProviders><NotificationsBell /></TestProviders>);
    await screen.findByText('1');

    fireEvent.click(screen.getByLabelText('Notifications'));
    fireEvent.click(await screen.findByText('告警 P1'));

    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith('n1'));
    expect(mockFetchUnreadCount).toHaveBeenCalled();
  });

  it('marks all as read', async () => {
    mockMarkAllRead.mockResolvedValue(2);
    render(<TestProviders><NotificationsBell /></TestProviders>);
    await screen.findByText('1');

    fireEvent.click(screen.getByLabelText('Notifications'));
    fireEvent.click(await screen.findByText('全部已读'));

    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledTimes(1));
  });
});