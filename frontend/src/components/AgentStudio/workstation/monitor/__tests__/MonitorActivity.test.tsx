import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonitorActivity from '../MonitorActivity';

vi.mock('../locales', () => ({ t: (k: string) => k }));

describe('MonitorActivity', { tags: ['integration'] }, () => {
  it('renders empty message when no activities', () => {
    render(<MonitorActivity activities={[]} />);
    expect(screen.getByText('monitor.no_activity')).toBeInTheDocument();
  });

  it('renders activities with action and time', () => {
    const activities = [
      { id: '1', time: '10:00', action: 'Agent started', target: 'agent-1', type: 'success' as const },
      { id: '2', time: '10:05', action: 'Rate limit hit', target: '', type: 'warning' as const },
      { id: '3', time: '10:10', action: 'Config updated', target: 'team-1', type: 'info' as const },
    ];
    render(<MonitorActivity activities={activities} />);
    expect(screen.getByText('Agent started')).toBeInTheDocument();
    expect(screen.getByText('Rate limit hit')).toBeInTheDocument();
    expect(screen.getByText('Config updated')).toBeInTheDocument();
  });
});
