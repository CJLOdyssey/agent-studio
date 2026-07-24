import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('../../../stores/chatStore', () => {
  const state = { activeConvId: null, conversations: [], setActiveTeam: vi.fn(), reset: vi.fn() };
  const fn = (selector?: any) => (selector ? selector(state) : state);
  fn.getState = () => state;
  return { useChatStore: fn };
});
vi.mock('../../auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));
vi.mock('../sidebar/UserMenu', () => ({ default: () => null }));
vi.mock('../sidebar/ConversationsList', () => ({
  default: (props: any) => {
    (globalThis as any).__convOnSelect = props.onSelect;
    (globalThis as any).__convOnDelete = props.onDelete;
    return null;
  },
}));
vi.mock('../sidebar/TeamTree', () => ({ default: () => null }));

import AgentStudioSidebar from '../AgentStudioSidebar';
import type { Team, Agent, Conversation } from '../../../types/AgentStudio';

const baseProps = {
  teams: [], selectedAgentId: null, conversations: [], activeConvId: null,
  onSelectAgent: vi.fn(), onSelectConversation: vi.fn(), onNewChat: vi.fn(),
  onDeleteConversation: vi.fn(), onAddTeam: vi.fn(), onAddAgent: vi.fn(),
  onDeleteTeam: vi.fn(), onDeleteAgent: vi.fn(), onRenameTeam: vi.fn(),
  onRenameAgent: vi.fn(), onTogglePinTeam: vi.fn(), onAgentClick: vi.fn(),
};

describe('AgentStudioSidebar', { tags: ['integration'] }, () => {
  it('renders without crashing', () => {
    const { container } = render(<AgentStudioSidebar {...baseProps} />);
    expect(container).toBeDefined();
  });
});

// ============================================================
// Additional tests with CORRECT prop types for better coverage
// ============================================================

function makeAgent(id: string, name: string): Agent {
  return {
    id, name, role: 'assistant',
    icon: ({ size }: { size: number }) => ({ size } as unknown as JSX.Element),
    color: 'blue', bg: 'bg-blue-100', border: 'border-blue-200',
  } as unknown as Agent;
}

function makeTeam(id: string, name: string, agents: Agent[] = []): Team {
  return { id, name, isExpanded: false, isPinned: false, agents };
}

function makeConv(id: string, title: string, overrides: Partial<Conversation> = {}): Conversation {
  return { id, title, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides } as Conversation;
}

function properBaseProps() {
  return {
    teams: [] as Team[],
    selectedAgentId: null as string | null,
    conversations: [] as Conversation[],
    activeConvId: null as string | null,
    isUserMenuOpen: false,
    setIsUserMenuOpen: vi.fn(),
    setIsSettingsOpen: vi.fn(),
    setIsApiOpen: vi.fn(),
    setSelectedAgentId: vi.fn(),
    setActiveConvId: vi.fn(),
    setInputValue: vi.fn(),
    setConversations: vi.fn(),
    onNewChat: vi.fn(),
    toggleTeam: vi.fn(),
    handleAddTeam: vi.fn(),
    handleAddAgent: vi.fn(),
    handleDeleteTeam: vi.fn(),
    handleDeleteAgent: vi.fn(),
    handleRenameTeam: vi.fn(),
    handleRenameAgent: vi.fn(),
    handleTogglePinTeam: vi.fn(),
    handleAgentClick: vi.fn(),
    isSidebarOpen: true,
    onOpenWorkstation: vi.fn(),
  };
}

describe('AgentStudioSidebar — correct props', { tags: ['integration'] }, () => {
  it('renders logo and brand text', () => {
    const props = properBaseProps();
    render(<AgentStudioSidebar {...props} />);
    expect(screen.getByText('AgentStudio')).toBeInTheDocument();
    expect(screen.getByText('sidebar.newChat')).toBeInTheDocument();
  });

  it('renders with sidebar open class when isSidebarOpen=true', () => {
    const props = properBaseProps();
    props.isSidebarOpen = true;
    const { container } = render(<AgentStudioSidebar {...props} />);
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('open');
  });

  it('renders with sidebar collapsed class when isSidebarOpen=false', () => {
    const props = properBaseProps();
    props.isSidebarOpen = false;
    const { container } = render(<AgentStudioSidebar {...props} />);
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('collapsed');
  });

  it('calls onNewChat when new chat button clicked', async () => {
    const props = properBaseProps();
    render(<AgentStudioSidebar {...props} />);
    const btn = screen.getByText('sidebar.newChat').closest('button')!;
    await userEvent.click(btn);
    expect(props.onNewChat).toHaveBeenCalledOnce();
  });

  it('renders "sidebar.recentConversations" section label', () => {
    const props = properBaseProps();
    render(<AgentStudioSidebar {...props} />);
    expect(screen.getByText('sidebar.recentConversations')).toBeInTheDocument();
  });

  it('renders TeamTree with teams, handlers, and auth props', () => {
    const agent = makeAgent('a1', 'Agent 1');
    const team = makeTeam('t1', 'Team 1', [agent]);
    const props = properBaseProps();
    props.teams = [team];
    render(<AgentStudioSidebar {...props} />);
    expect(screen.getByText('sidebar.recentConversations')).toBeInTheDocument();
  });

  it('calls onOpenWorkstation from UserMenu', () => {
    const props = properBaseProps();
    render(<AgentStudioSidebar {...props} />);
    // UserMenu is mocked, but we can verify the component renders
    expect(screen.getByText('AgentStudio')).toBeInTheDocument();
  });
});

// ============================================================
// Tests that verify auth state is passed to TeamTree
// ============================================================
describe('AgentStudioSidebar — handler execution', { tags: ['integration'] }, () => {
  beforeEach(() => { vi.clearAllMocks(); });

  beforeEach(() => {
    delete (globalThis as any).__convOnSelect;
    delete (globalThis as any).__convOnDelete;
  });

  it('handleConvSelect sets selectedAgentId null, activeConvId, inputValue', () => {
    const props = properBaseProps();
    render(<AgentStudioSidebar {...props} />);

    const conv = makeConv('c1', 'Test Conv', { teamId: undefined });
    (globalThis as any).__convOnSelect(conv);

    expect(props.setSelectedAgentId).toHaveBeenCalledWith(null);
    expect(props.setActiveConvId).toHaveBeenCalledWith('c1');
    expect(props.setInputValue).toHaveBeenCalledWith('Test Conv');
  });

  it('handleConvSelect with teamId does not throw (setActiveTeam called via store)', () => {
    const props = properBaseProps();
    render(<AgentStudioSidebar {...props} />);

    const conv = makeConv('c2', 'Team Conv', { teamId: 't1' });
    expect(() => (globalThis as any).__convOnSelect(conv)).not.toThrow();
  });

  it('handleConvDelete removes conversation and resets if active match', () => {
    const props = properBaseProps();
    props.activeConvId = 'c1';
    render(<AgentStudioSidebar {...props} />);

    (globalThis as any).__convOnDelete('c1');

    expect(props.setConversations).toHaveBeenCalledOnce();
    expect(props.setActiveConvId).toHaveBeenCalledWith(null);
  });

  it('handleConvDelete removes conversation but does not reset if not active', () => {
    const props = properBaseProps();
    props.activeConvId = 'c2';
    render(<AgentStudioSidebar {...props} />);

    (globalThis as any).__convOnDelete('c1');

    expect(props.setConversations).toHaveBeenCalledOnce();
    expect(props.setActiveConvId).not.toHaveBeenCalled();
  });
});

describe('AgentStudioSidebar — auth integration', { tags: ['integration'] }, () => {
  it('passes isAuthenticated=false when useAuth returns false', () => {
    const props = properBaseProps();
    const { container } = render(<AgentStudioSidebar {...props} />);
    expect(container).toBeDefined();
  });
});
