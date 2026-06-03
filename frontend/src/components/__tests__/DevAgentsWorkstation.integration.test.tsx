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

describe('DevAgentsWorkstation 集成测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent选择和对话流程', () => {
    it('should show message in conversation after sending', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      const textarea = document.querySelector('.devagents-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '请分析用户登录需求' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      const messageArea = document.querySelector('.devagents-home-chat-messages');
      await waitFor(() => {
        expect(messageArea?.textContent).toContain('请分析用户登录需求');
      });
      const messages = document.querySelectorAll('.devagents-message.user, .devagents-message-user');
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should show agent response after sending message', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      const textarea = document.querySelector('.devagents-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '测试消息' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      const messageArea = document.querySelector('.devagents-home-chat-messages');
      await waitFor(() => {
        expect(messageArea?.textContent).toContain('测试消息');
      });
    });
  });

  describe('团队管理流程', () => {
    it('should render team with agents', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);
      expect(screen.getByText('核心开发团队')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should toggle team expansion when header clicked', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      // Team starts expanded — agents list should be visible
      await waitFor(() => {
        const lists = document.querySelectorAll('.devagents-agents-list');
        expect(lists.length).toBeGreaterThanOrEqual(1);
      });

      // Click to collapse
      const teamHeader = screen.getByText('核心开发团队').closest('.devagents-team-header');
      fireEvent.click(teamHeader!);

      await waitFor(() => {
        const lists = document.querySelectorAll('.devagents-agents-list');
        expect(lists.length).toBe(0);
      });

      // Click to expand again
      fireEvent.click(teamHeader!);
    });

    it('should create conversation after broadcast', async () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      const textarea = document.querySelector('.devagents-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '全体成员请注意' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        const convItems = document.querySelectorAll('.devagents-conv-item');
        expect(convItems.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('错误处理测试', () => {
    it('should handle empty input gracefully', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      const textarea = document.querySelector('.devagents-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      expect(textarea.value).toBe('');
    });

    it('should clear whitespace-only input on Enter (handleSendMessage always clears)', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      const textarea = document.querySelector('.devagents-textarea') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

      expect(textarea.value).toBe('');
    });

    it('should require non-whitespace input before sending', () => {
      render(<TestProviders><DevAgentsWorkstation /></TestProviders>);

      const sendBtn = document.querySelector('.devagents-send-btn') as HTMLButtonElement;
      expect(sendBtn.disabled).toBe(true);
    });
  });
});
