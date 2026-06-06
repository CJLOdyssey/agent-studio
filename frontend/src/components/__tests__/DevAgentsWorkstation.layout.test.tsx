import { render, screen } from '@testing-library/react';
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

const mockTeams = [
  {
    id: 'team-1',
    name: '核心开发团队',
    order: 1,
    is_expanded: true,
    agents: [
      { id: 'a1', name: '产品经理', role: '产品经理', order: 1 },
      { id: 'a2', name: '前端工程师', role: '前端工程师', order: 2 },
      { id: 'a3', name: '后端工程师', role: '后端工程师', order: 3 },
      { id: 'a4', name: '测试工程师', role: '测试工程师', order: 4 },
      { id: 'a5', name: 'UI/UX 设计师', role: 'UI/UX 设计师', order: 5 },
      { id: 'a6', name: 'DevOps 工程师', role: 'DevOps 工程师', order: 6 },
      { id: 'a7', name: '项目经理', role: '项目经理', order: 7 },
      { id: 'a8', name: '产品经理', role: '产品经理', order: 8 },
    ],
  },
];

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/teams') return Promise.resolve({ data: mockTeams });
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: {} },
  },
  executeCommand: vi.fn(() => Promise.resolve({ success: true, message: '' })),
  submitRequirement: vi.fn(() => Promise.resolve({ run_id: 'r1', session_id: 's1' })),
  listKeys: vi.fn(() => Promise.resolve([])),
  listAgents: vi.fn(() => Promise.resolve([])),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  toggleAgent: vi.fn(),
}));

describe('DevAgentsWorkstation 布局测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('首页结构', () => {
    it('should render devagents-layout container', () => {
      render(
        <TestProviders>
          <DevAgentsWorkstation />
        </TestProviders>,
      );
      const layout = document.querySelector('.devagents-layout');
      expect(layout).toBeInTheDocument();
    });

    it('should render devagents-main container', () => {
      render(
        <TestProviders>
          <DevAgentsWorkstation />
        </TestProviders>,
      );
      const mainContainer = document.querySelector('.devagents-main');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should render textarea on home page', () => {
      render(
        <TestProviders>
          <DevAgentsWorkstation />
        </TestProviders>,
      );
      const textarea = document.querySelector('.devagents-textarea');
      expect(textarea).toBeInTheDocument();
    });

    it('should render input-wrapper on home page', () => {
      render(
        <TestProviders>
          <DevAgentsWorkstation />
        </TestProviders>,
      );
      const inputWrapper = document.querySelector('.devagents-input-wrapper');
      expect(inputWrapper).toBeInTheDocument();
    });

    it('should display subtitle text', () => {
      render(
        <TestProviders>
          <DevAgentsWorkstation />
        </TestProviders>,
      );
      expect(screen.getByText('描述你的需求，我来帮你分析和规划')).toBeInTheDocument();
    });

    it('should render send button', () => {
      render(
        <TestProviders>
          <DevAgentsWorkstation />
        </TestProviders>,
      );
      expect(screen.getByText('发送')).toBeInTheDocument();
    });
  });
});
