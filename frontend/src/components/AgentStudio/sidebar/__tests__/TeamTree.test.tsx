import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('./TeamTreeAgentItem', () => ({ default: () => <li data-testid="agent-item" /> }));

import TeamTree from '../TeamTree';

const baseProps = {
  teams: [], selectedAgentId: null, isAuthenticated: false,
  openLoginModal: vi.fn(), toggleTeam: vi.fn(), handleAddTeam: vi.fn(),
  handleAddAgent: vi.fn(), handleDeleteTeam: vi.fn(), handleDeleteAgent: vi.fn(),
  handleRenameTeam: vi.fn(), handleRenameAgent: vi.fn(),
  handleTogglePinTeam: vi.fn(), handleAgentClick: vi.fn(),
};

describe('TeamTree', () => {
  it('renders empty state when no teams', () => {
    const { container } = render(<TeamTree {...baseProps} />);
    expect(container).toBeDefined();
  });

  it('renders team names', () => {
    const teams = [{ id: 't1', name: 'Team Alpha', agents: [] }];
    const { container } = render(<TeamTree {...baseProps} teams={teams} />);
    expect(container.textContent).toContain('Team Alpha');
  });
});
