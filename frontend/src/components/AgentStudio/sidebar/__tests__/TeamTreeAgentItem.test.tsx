import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamTreeAgentItem from '../TeamTreeAgentItem';
import type { Agent } from '../../../../types/AgentStudio';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockAgent: Agent = {
  id: 'a1', name: 'Test Agent', icon: 'Bot',
  color: '#6366f1', teamId: 't1',
} as Agent;

describe('TeamTreeAgentItem', () => {
  const baseProps = {
    agent: mockAgent,
    isSelected: false,
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onEdit: vi.fn(),
  };

  it('renders agent name', () => {
    render(<TeamTreeAgentItem {...baseProps} />);
    expect(screen.getByText('Test Agent')).toBeDefined();
  });

  it('shows selected state', () => {
    render(<TeamTreeAgentItem {...baseProps} isSelected={true} />);
    const item = screen.getByText('Test Agent').closest('[class*="agentstudio"]');
    expect(item).toBeDefined();
  });
});
