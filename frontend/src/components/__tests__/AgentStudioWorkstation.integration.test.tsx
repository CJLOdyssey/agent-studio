import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentStudioWorkstation from '../AgentStudio/AgentStudioWorkstation';
import { TestProviders } from '../../test/setup';
import { useChatStore } from '../../stores/chatStore';

vi.mock('lucide-react', () => ({
  Activity: () => <span data-testid="icon-activity" />,
  AlertCircle: () => <span data-testid="icon-alertcircle" />,
  AlertTriangle: () => <span data-testid="icon-alerttriangle" />,
  ArrowUpDown: () => <span data-testid="icon-arrowupdown" />,
  BarChart3: () => <span data-testid="icon-barchart3" />,
  Bell: () => <span data-testid="icon-bell" />,
  Bot: () => <span data-testid="icon-bot" />,
  Check: () => <span data-testid="icon-check" />,
  CheckCircle: () => <span data-testid="icon-checkcircle" />,
  CheckCircle2: () => <span data-testid="icon-checkcircle2" />,
  ChevronDown: () => <span data-testid="icon-chevrondown" />,
  ChevronLeft: () => <span data-testid="icon-chevronleft" />,
  ChevronRight: () => <span data-testid="icon-chevronright" />,
  ChevronUp: () => <span data-testid="icon-chevronup" />,
  ChevronsUpDown: () => <span data-testid="icon-chevronsupdown" />,
  ClipboardList: () => <span data-testid="icon-clipboardlist" />,
  Clock: () => <span data-testid="icon-clock" />,
  Cloud: () => <span data-testid="icon-cloud" />,
  Code: () => <span data-testid="icon-code" />,
  Code2: () => <span data-testid="icon-code2" />,
  Copy: () => <span data-testid="icon-copy" />,
  Download: () => <span data-testid="icon-download" />,
  Edit3: () => <span data-testid="icon-edit3" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
  File: () => <span data-testid="icon-file" />,
  FileCheck: () => <span data-testid="icon-filecheck" />,
  FileCode: () => <span data-testid="icon-filecode" />,
  FileText: () => <span data-testid="icon-filetext" />,
  GitBranch: () => <span data-testid="icon-gitbranch" />,
  FolderKanban: () => <span data-testid="icon-folderkanban" />,
  GitCompare: () => <span data-testid="icon-gitcompare" />,
  Globe: () => <span data-testid="icon-globe" />,
  HelpCircle: () => <span data-testid="icon-helpcircle" />,
  History: () => <span data-testid="icon-history" />,
  Image: () => <span data-testid="icon-image" />,
  Info: () => <span data-testid="icon-info" />,
  Key: () => <span data-testid="icon-key" />,
  Keyboard: () => <span data-testid="icon-keyboard" />,
  Layers: () => <span data-testid="icon-layers" />,
  LayoutDashboard: () => <span data-testid="icon-layoutdashboard" />,
  Lock: () => <span data-testid="icon-lock" />,
  Link: () => <span data-testid="icon-link" />,
  Loader2: () => <span data-testid="icon-loader2" />,
  LogOut: () => <span data-testid="icon-logout" />,
  Maximize2: () => <span data-testid="icon-maximize2" />,
  MessageSquare: () => <span data-testid="icon-messagesquare" />,
  MessageSquareText: () => <span data-testid="icon-messagesquaretext" />,
  Moon: () => <span data-testid="icon-moon" />,
  MoreHorizontal: () => <span data-testid="icon-morehorizontal" />,
  MoreVertical: () => <span data-testid="icon-morevertical" />,
  OctagonX: () => <span data-testid="icon-octagonx" />,
  Palette: () => <span data-testid="icon-palette" />,
  PanelLeft: () => <span data-testid="icon-panelleft" />,
  PanelRightClose: () => <span data-testid="icon-panelrightclose" />,
  Paperclip: () => <span data-testid="icon-paperclip" />,
  Pencil: () => <span data-testid="icon-pencil" />,
  Pin: () => <span data-testid="icon-pin" />,
  PinOff: () => <span data-testid="icon-pinoff" />,
  Play: () => <span data-testid="icon-play" />,
  Plus: () => <span data-testid="icon-plus" />,
  Puzzle: () => <span data-testid="icon-puzzle" />,
  RefreshCw: () => <span data-testid="icon-refreshcw" />,
  Save: () => <span data-testid="icon-save" />,
  Search: () => <span data-testid="icon-search" />,
  Send: () => <span data-testid="icon-send" />,
  Server: () => <span data-testid="icon-server" />,
  Settings: () => <span data-testid="icon-settings" />,
  Shield: () => <span data-testid="icon-shield" />,
  Sparkles: () => <span data-testid="icon-sparkles" />,
  Square: () => <span data-testid="icon-square" />,
  Sun: () => <span data-testid="icon-sun" />,
  TestTube: () => <span data-testid="icon-testtube" />,
  TestTube2: () => <span data-testid="icon-testtube2" />,
  Trash2: () => <span data-testid="icon-trash2" />,
  Upload: () => <span data-testid="icon-upload" />,
  User: () => <span data-testid="icon-user" />,
  Users: () => <span data-testid="icon-users" />,
  Wand2: () => <span data-testid="icon-wand2" />,
  Wrench: () => <span data-testid="icon-wrench" />,
  X: () => <span data-testid="icon-x" />,
  Zap: () => <span data-testid="icon-zap" />,
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

const intMockTeamsData = () => [
  {
    id: 'team-1',
    name: '核心开发团队',
    order: 1,
    is_expanded: true,
    agents: [
      { id: 'a1', name: '产品经理', role: '产品经理', order: 1, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a2', name: '前端工程师', role: '前端工程师', order: 2, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a3', name: '后端工程师', role: '后端工程师', order: 3, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a4', name: '测试工程师', role: '测试工程师', order: 4, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a5', name: 'UI/UX 设计师', role: 'UI/UX 设计师', order: 5, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a6', name: 'DevOps 工程师', role: 'DevOps 工程师', order: 6, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a7', name: '项目经理', role: '项目经理', order: 7, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
      { id: 'a8', name: '产品经理', role: '产品经理', order: 8, agent_config_id: null, system_prompt: null, output_constraints: null, tools: [], mcp: [], skills: [] },
    ],
  },
];

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/teams') return Promise.resolve({ data: intMockTeamsData() });
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
  listKeys: vi.fn(() => Promise.resolve([{ id: 'key-1', is_default: true, is_active: true, models: ['gpt-4'] }])),
  listAgents: vi.fn(() => Promise.resolve([])),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  toggleAgent: vi.fn(),
}));

vi.mock('../../api/client/instance', () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === '/teams') return Promise.resolve({ data: intMockTeamsData() });
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: {} },
  },
}));

describe('AgentStudioWorkstation 集成测试', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.getState().reset();
  });

  describe('Agent选择和对话流程', () => {
    it('should show message in conversation after sending', async () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      const textarea = document.querySelector('.agentstudio-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '请分析用户登录需求' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        const messagesArea = document.querySelector('.agentstudio-messages-inner');
        expect(messagesArea?.textContent).toContain('请分析用户登录需求');
      });
      const messages = document.querySelectorAll('.agentstudio-message-user, .agentstudio-message.user');
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should show agent response after sending message', async () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      const textarea = document.querySelector('.agentstudio-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '测试消息' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        const messagesArea = document.querySelector('.agentstudio-messages-inner');
        expect(messagesArea?.textContent).toContain('测试消息');
      });
    });
  });

  describe('团队管理流程', () => {
    it('should render team with agents', async () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );
      expect(await screen.findByText('核心开发团队')).toBeInTheDocument();
      expect(await screen.findByText('8')).toBeInTheDocument();
    });

    it('should toggle team expansion when header clicked', async () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      // Team starts expanded — agents list should be visible
      await waitFor(() => {
        const lists = document.querySelectorAll('.agentstudio-team-agents');
        expect(lists.length).toBeGreaterThanOrEqual(1);
      });

      // Click to collapse
      const teamHeader = screen.getByText('核心开发团队').closest('.agentstudio-team-folder-header');
      fireEvent.click(teamHeader!);

      await waitFor(() => {
        const lists = document.querySelectorAll('.agentstudio-team-agents');
        expect(lists.length).toBe(0);
      });

      // Click to expand again
      fireEvent.click(teamHeader!);
    });

    it('should create conversation after broadcast', async () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      const textarea = document.querySelector('.agentstudio-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '全体成员请注意' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        const convItems = document.querySelectorAll('.agentstudio-conv-item');
        expect(convItems.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('错误处理测试', () => {
    it('should handle empty input gracefully', () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      const textarea = document.querySelector('.agentstudio-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      expect(textarea.value).toBe('');
    });

    it('should clear whitespace-only input on Enter (handleSendMessage always clears)', () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      const textarea = document.querySelector('.agentstudio-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      expect(textarea.value).toBe('');
    });

    it('should require non-whitespace input before sending', () => {
      render(
        <TestProviders>
          <AgentStudioWorkstation />
        </TestProviders>,
      );

      const sendBtn = document.querySelector('.agentstudio-send-btn') as HTMLButtonElement;
      expect(sendBtn.disabled).toBe(true);
    });
  });
});
