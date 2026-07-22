import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Bot } from 'lucide-react';
import MonitorStats from '../MonitorStats';

describe('MonitorStats', () => {
  const statCards = [
    { key: 'agents' as const, icon: Bot, label: 'Agents', tab: 'agents' },
    { key: 'tools' as const, icon: Bot, label: 'Tools', tab: 'tools' },
    { key: 'teams' as const, icon: Bot, label: 'Teams', tab: 'teams' },
  ];

  it('renders stat cards', () => {
    render(
      <MonitorStats
        stats={{ agents: 5, prompts: 10, tools: 3, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }}
        statCards={statCards}
      />,
    );
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders dash for null stats', () => {
    render(
      <MonitorStats
        stats={null}
        statCards={statCards}
      />,
    );
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });
});
