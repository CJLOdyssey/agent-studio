import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Bot } from 'lucide-react';
import MonitorStats from '../MonitorStats';

describe('MonitorStats', { tags: ['integration'] }, () => {
  const statCards = [
    { key: 'agents' as const, icon: Bot, label: 'Agents', tab: 'agents' },
    { key: 'tools' as const, icon: Bot, label: 'Tools', tab: 'tools' },
    { key: 'teams' as const, icon: Bot, label: 'Teams', tab: 'teams' },
  ];

  beforeEach(() => { vi.clearAllMocks(); });

  it('renders stat cards with values', () => {
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
      <MonitorStats stats={null} statCards={statCards} />,
    );
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('renders nothing when statCards is empty', () => {
    const { container } = render(
      <MonitorStats stats={{ agents: 5, prompts: 10, tools: 3, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }} statCards={[]} />,
    );
    expect(container.querySelector('.wsta-monitor-stat-card')).toBeNull();
  });

  it('calls onNavigate when stat card clicked', () => {
    const onNavigate = vi.fn();
    render(
      <MonitorStats stats={{ agents: 5, prompts: 10, tools: 3, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }} statCards={statCards} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByText('Agents').closest('.wsta-monitor-stat-card')!);
    expect(onNavigate).toHaveBeenCalledWith('agents');
  });

  it('renders stats with partial null fields as dash', () => {
    render(
      <MonitorStats
        stats={{ agents: 5, prompts: 10, tools: null as unknown as number, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }}
        statCards={statCards}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('does not crash when onNavigate is not provided', () => {
    render(
      <MonitorStats stats={{ agents: 5, prompts: 10, tools: 3, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }} statCards={statCards} />,
    );
    expect(() => fireEvent.click(screen.getByText('Agents').closest('.wsta-monitor-stat-card')!)).not.toThrow();
  });

  it('applies hover styles on mouse enter', () => {
    render(
      <MonitorStats stats={{ agents: 5, prompts: 10, tools: 3, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }} statCards={statCards} />,
    );
    const card = screen.getByText('Agents').closest('.wsta-monitor-stat-card')! as HTMLElement;
    fireEvent.mouseEnter(card);
    expect(card.style.transform).toBe('translateY(-2px)');
  });

  it('clears hover styles on mouse leave', () => {
    render(
      <MonitorStats stats={{ agents: 5, prompts: 10, tools: 3, mcps: 2, skills: 4, teams: 1, logs_today: 0, updated_at: '2024-01-01' }} statCards={statCards} />,
    );
    const card = screen.getByText('Agents').closest('.wsta-monitor-stat-card')! as HTMLElement;
    fireEvent.mouseEnter(card);
    expect(card.style.transform).toBe('translateY(-2px)');
    fireEvent.mouseLeave(card);
    expect(card.style.transform).toBe('');
  });
});
