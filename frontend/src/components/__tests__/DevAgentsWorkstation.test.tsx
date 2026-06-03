import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DevAgentsWorkstation from '../devagents/DevAgentsWorkstation';
import { TestProviders } from '../../test/setup';

vi.mock('lucide-react', () => ({
  Bot: () => <span data-testid="icon-bot" />,
  User: () => <span data-testid="icon-user" />,
  Settings: () => <span data-testid="icon-settings" />,
  Code2: () => <span data-testid="icon-code2" />,
  Server: () => <span data-testid="icon-server" />,
  TestTube: () => <span data-testid="icon-testtube" />,
  Palette: () => <span data-testid="icon-palette" />,
  Send: () => <span data-testid="icon-send" />,
  Paperclip: () => <span data-testid="icon-paperclip" />,
  Layout: () => <span data-testid="icon-layout" />,
  CheckCircle2: () => <span data-testid="icon-checkcircle" />,
  Loader2: () => <span data-testid="icon-loader" />,
  ChevronRight: () => <span data-testid="icon-chevronright" />,
  ChevronDown: () => <span data-testid="icon-chevrondown" />,
  ChevronUp: () => <span data-testid="icon-chevronup" />,
  Terminal: () => <span data-testid="icon-terminal" />,
  Maximize2: () => <span data-testid="icon-maximize" />,
  PanelRightClose: () => <span data-testid="icon-panelright" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  FolderKanban: () => <span data-testid="icon-folderkanban" />,
  GitBranch: () => <span data-testid="icon-gitbranch" />,
  Play: () => <span data-testid="icon-play" />,
  Bug: () => <span data-testid="icon-bug" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  MessageSquare: () => <span data-testid="icon-messagesquare" />,
  Plus: () => <span data-testid="icon-plus" />,
  Users: () => <span data-testid="icon-users" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Trash2: () => <span data-testid="icon-trash" />,
  LogOut: () => <span data-testid="icon-logout" />,
  HelpCircle: () => <span data-testid="icon-helpcircle" />,
  Key: () => <span data-testid="icon-key" />,
  UserCircle: () => <span data-testid="icon-usercircle" />,
  FileCode: () => <span data-testid="icon-filecode" />,
  Folder: () => <span data-testid="icon-folder" />,
  TestTube2: () => <span data-testid="icon-testtube2" />,
  ClipboardList: () => <span data-testid="icon-clipboardlist" />,
  Layers: () => <span data-testid="icon-layers" />,
  Cloud: () => <span data-testid="icon-cloud" />,
  Zap: () => <span data-testid="icon-zap" />,
  Copy: () => <span data-testid="icon-copy" />,
  Check: () => <span data-testid="icon-check" />,
}));

vi.mock('../../api/hooks', () => ({
  useAgents: () => ({ data: [], isLoading: false, isSuccess: true }),
  useSessions: () => ({ data: [], isLoading: false, isSuccess: true }),
  useRuns: () => ({ data: [], isLoading: false, isSuccess: true }),
  useRun: () => ({ data: null, isLoading: false, isSuccess: false }),
  useSessionDetail: () => ({ data: null, isLoading: false, isSuccess: false }),
  useCreateSession: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useDeleteSession: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useCreateAgent: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useUpdateAgent: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useToggleAgent: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
  useAvailableModels: () => [],
  useCommands: () => ({ data: [], isLoading: false, isSuccess: true }),
  prefetchAgents: vi.fn(),
}));

describe('DevAgentsWorkstation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('团队列表渲染', () => {
    it('should render "我的团队" section header', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('我的团队')).toBeInTheDocument();
    });

    it('should render "核心开发团队" team', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('核心开发团队')).toBeInTheDocument();
    });

    it('should show team member count (8)', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should render "新建对话" button', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('新建对话')).toBeInTheDocument();
    });
  });

  describe('Agent列表渲染', () => {
    it('should render all 8 agents in sidebar', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      // Team starts expanded — agents are already visible
      await new Promise(resolve => setTimeout(resolve, 100));

      const sidebarAgents = document.querySelectorAll('.devagents-sidebar .devagents-agent-name');
      expect(sidebarAgents.length).toBe(8);
    });
  });

  describe('Agent点击交互', () => {
    it('should select agent when clicked in sidebar', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      // Team starts expanded — agents are already visible; no toggle needed
      await new Promise(resolve => setTimeout(resolve, 100));

      const sidebarAgents = document.querySelectorAll('.devagents-sidebar .devagents-agent-item');
      fireEvent.click(sidebarAgents[0]);

      expect(screen.getByText(/与 产品经理 对话/)).toBeInTheDocument();
    });

    it('should show back button when agent is selected', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      await new Promise(resolve => setTimeout(resolve, 100));

      const sidebarAgents = document.querySelectorAll('.devagents-sidebar .devagents-agent-item');
      fireEvent.click(sidebarAgents[0]);

      expect(screen.getByText('返回')).toBeInTheDocument();
    });

    it('should render home page structure after returning from agent', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      await new Promise(resolve => setTimeout(resolve, 100));

      const sidebarAgents = document.querySelectorAll('.devagents-sidebar .devagents-agent-item');
      fireEvent.click(sidebarAgents[0]);

      fireEvent.click(screen.getByText('返回'));

      const homeSection = document.querySelector('.devagents-home');
      expect(homeSection).toBeInTheDocument();
    });
  });

  describe('团队展开/折叠', () => {
    it('should toggle team expansion when header clicked', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      // Team starts expanded — agents list should be visible
      await new Promise(resolve => setTimeout(resolve, 100));
      const agentsList = document.querySelector('.devagents-agents-list');
      expect(agentsList).toBeInTheDocument();

      // First click: collapse
      const teamHeader = screen.getByText('核心开发团队').closest('.devagents-team-header');
      fireEvent.click(teamHeader!);
      await new Promise(resolve => setTimeout(resolve, 100));

      const agentsListCollapsed = document.querySelectorAll('.devagents-agents-list');
      expect(agentsListCollapsed.length).toBe(0);

      // Second click: expand again
      fireEvent.click(teamHeader!);
      await new Promise(resolve => setTimeout(resolve, 100));

      const agentsListExpanded = document.querySelector('.devagents-agents-list');
      expect(agentsListExpanded).toBeInTheDocument();
    });
  });

  describe('消息发送', () => {
    it('should render input area with placeholder', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByPlaceholderText(/描述你的需求/)).toBeInTheDocument();
    });

    it('should update input value when typing', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      const textarea = screen.getByPlaceholderText(/描述你的需求/) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '测试消息' } });
      expect(textarea.value).toBe('测试消息');
    });

    it('should send message on Enter key press', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      const textarea = screen.getByPlaceholderText(/描述你的需求/) as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '测试消息' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
      const messageArea = document.querySelector('.devagents-home-chat-messages');
      await waitFor(() => {
        expect(messageArea?.textContent).toContain('测试消息');
      });
    });
  });

  describe('工作区交互', () => {
    it('should not show workspace on main channel', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.queryByText('资源管理器')).not.toBeInTheDocument();
    });

    it('should show open button and open workspace when clicked', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      // Team starts expanded — agents are already visible; no toggle needed
      await new Promise(resolve => setTimeout(resolve, 100));

      const sidebarAgents = document.querySelectorAll('.devagents-sidebar .devagents-agent-item');
      fireEvent.click(sidebarAgents[0]);

      expect(screen.queryByText('资源管理器')).not.toBeInTheDocument();
      expect(screen.getByText('打开代码工作区')).toBeInTheDocument();

      fireEvent.click(screen.getByText('打开代码工作区'));
      expect(screen.getByText('资源管理器')).toBeInTheDocument();
    });
  });

  describe('页面导航', () => {
    it('should display typing animation on home page', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      const cursor = document.querySelector('.typing-cursor');
      expect(cursor).toBeInTheDocument();
    });

    it('should display subtitle on home page', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('描述你的需求，我来帮你分析和规划')).toBeInTheDocument();
    });
  });

  describe('用户菜单', () => {
    it('should render user button with default user ID', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('User 1001')).toBeInTheDocument();
    });

    it('should open user menu when clicked', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      const userBtn = screen.getByText('User 1001').closest('.devagents-user-btn');
      fireEvent.click(userBtn!);

      expect(screen.getByText('系统设置')).toBeInTheDocument();
      expect(screen.getByText('API 管理')).toBeInTheDocument();
      expect(screen.getByText('帮助与反馈')).toBeInTheDocument();
      expect(screen.getByText('退出登录')).toBeInTheDocument();
    });
  });
});
