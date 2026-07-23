import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../stores/chatStore', () => ({
  useChatStore: () => ({ activeConvId: null, conversations: [] }),
}));
vi.mock('../../auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));
vi.mock('../sidebar/UserMenu', () => ({ default: () => null }));
vi.mock('../sidebar/ConversationsList', () => ({ default: () => null }));
vi.mock('../sidebar/TeamTree', () => ({ default: () => null }));

import AgentStudioSidebar from '../AgentStudioSidebar';

const baseProps = {
  teams: [], selectedAgentId: null, conversations: [], activeConvId: null,
  onSelectAgent: vi.fn(), onSelectConversation: vi.fn(), onNewChat: vi.fn(),
  onDeleteConversation: vi.fn(), onAddTeam: vi.fn(), onAddAgent: vi.fn(),
  onDeleteTeam: vi.fn(), onDeleteAgent: vi.fn(), onRenameTeam: vi.fn(),
  onRenameAgent: vi.fn(), onTogglePinTeam: vi.fn(), onAgentClick: vi.fn(),
};

describe('AgentStudioSidebar', () => {
  it('renders without crashing', () => {
    const { container } = render(<AgentStudioSidebar {...baseProps} />);
    expect(container).toBeDefined();
  });
});
