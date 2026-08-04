import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentStudioWorkstation from '../AgentStudioWorkstation';
import { TestProviders } from '../../../test/setup';
import { useChatStore } from '../../../stores/chatStore';
import type { Conversation } from '../../../types/AgentStudio';

const { wsCallbacks, mockSubmitRequirement, mockConnectRun, mockGetSessionDetail } = vi.hoisted(() => ({
  wsCallbacks: new Map<string, (data: Record<string, unknown>) => void>(),
  mockSubmitRequirement: vi.fn(),
  mockConnectRun: vi.fn(),
  mockGetSessionDetail: vi.fn(),
}));

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
  Cpu: () => <span data-testid="icon-cpu" />,
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
  LogIn: () => <span data-testid="icon-login" />,
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
  RotateCcw: () => <span data-testid="icon-rotateccw" />,
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
  ThumbsUp: () => <span data-testid="icon-thumbsup" />,
  ThumbsDown: () => <span data-testid="icon-thumbsdown" />,
  Trash2: () => <span data-testid="icon-trash2" />,
  Upload: () => <span data-testid="icon-upload" />,
  User: () => <span data-testid="icon-user" />,
  Users: () => <span data-testid="icon-users" />,
  Wand2: () => <span data-testid="icon-wand2" />,
  Wrench: () => <span data-testid="icon-wrench" />,
  X: () => <span data-testid="icon-x" />,
  Zap: () => <span data-testid="icon-zap" />,
}));

vi.mock('../../../api/websocket', () => ({
  connectRun: mockConnectRun,
  disconnectRun: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  submitRequirement: mockSubmitRequirement,
  resumeRun: vi.fn(),
  listKeys: vi.fn(() => Promise.resolve([{ id: 'key-1', is_default: true, is_active: true, models: ['gpt-4'] }])),
  listAgents: vi.fn(() => Promise.resolve([])),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  toggleAgent: vi.fn(),
  executeCommand: vi.fn(() => Promise.resolve({ success: true, message: '' })),
}));

vi.mock('../../../api/client/sessions', () => ({
  getSessionDetail: mockGetSessionDetail,
  listSessions: vi.fn(() => Promise.resolve([])),
  deleteSession: vi.fn(() => Promise.resolve()),
  updateAnswerVersions: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../api/hooks', () => ({
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

vi.mock('../../../hooks/useTeamManagement', () => {
  const MockIcon = () => null;
  const agents = [
    { id: 'a1', name: '产品经理', role: '产品经理', icon: MockIcon, color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-300' },
    { id: 'a2', name: '前端工程师', role: '前端工程师', icon: MockIcon, color: 'text-green-500', bg: 'bg-green-100', border: 'border-green-300' },
    { id: 'a3', name: '后端工程师', role: '后端工程师', icon: MockIcon, color: 'text-purple-500', bg: 'bg-purple-100', border: 'border-purple-300' },
    { id: 'a4', name: '测试工程师', role: '测试工程师', icon: MockIcon, color: 'text-orange-500', bg: 'bg-orange-100', border: 'border-orange-300' },
  ];
  return {
    useTeamManagement: () => ({
      teams: [{
        id: 'team-1',
        name: '核心开发团队',
        isExpanded: true,
        isPinned: false,
        agents,
      }],
      allAgents: agents,
      editingTeamId: null,
      editTeamName: '',
      setEditTeamName: vi.fn(),
      toggleTeam: vi.fn(),
      handleAddTeam: vi.fn(),
      startEditTeam: vi.fn(),
      saveEditTeam: vi.fn(),
      cancelEditTeam: vi.fn(),
      saveTeamName: vi.fn(),
      handleTeamNameKeyDown: vi.fn(),
      handleRename: vi.fn(),
      handleDeleteTeam: vi.fn(),
      handleTogglePinTeam: vi.fn(),
      handleAddAgent: vi.fn(),
      handleRenameAgent: vi.fn(),
      handleDeleteAgent: vi.fn(),
      handleAgentConfigSave: vi.fn(),
      replaceAgentId: vi.fn(),
      linkMemberAgent: vi.fn(),
    }),
  };
});

function seedConversations() {
  const now = Date.now();
  const mk = (id: string, title: string, messages: Array<{ id: string; role: 'user' | 'agent'; content: string }>): Conversation => ({
    id,
    title,
    messages: messages.map((m, i) => ({ ...m, timestamp: now - (messages.length - i) * 30000 })),
    createdAt: new Date(now - 3600_000).toISOString(),
    updatedAt: new Date(now - 1000).toISOString(),
  });
  const convA = mk('conv-a', '第一段对话', [
    { id: 'a-1', role: 'user', content: '对话A的用户消息' },
    { id: 'a-2', role: 'agent', content: '对话A的回复' },
  ]);
  const convB = mk('conv-b', '第二段对话', [
    { id: 'b-1', role: 'user', content: '对话B的用户消息' },
    { id: 'b-2', role: 'agent', content: '对话B的回复' },
  ]);
  localStorage.setItem('agentstudio-conversations', JSON.stringify([convA, convB]));
  localStorage.setItem('agentstudio-active-conv-id', 'conv-a');
}

describe('AgentStudioWorkstation 集成测试', { tags: ['integration'] }, () => {
  beforeEach(() => {
    localStorage.clear();
    wsCallbacks.clear();
    vi.clearAllMocks();
    useChatStore.getState().reset();
    mockConnectRun.mockImplementation((runId: string, opts: { onMessage: (data: Record<string, unknown>) => void }) => {
      wsCallbacks.set(runId, opts.onMessage);
      return vi.fn();
    });
    mockGetSessionDetail.mockResolvedValue({ runs: [] });
  });

  function messagesArea(): HTMLElement {
    const el = document.querySelector('main [aria-live="polite"]');
    if (!el) throw new Error('消息区（aria-live）未渲染');
    return el as HTMLElement;
  }

  async function sendMessage(text: string) {
    const textarea = await screen.findByPlaceholderText(/描述你的需求/);
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });
  }

  function emitWs(runId: string, event: Record<string, unknown>) {
    const cb = wsCallbacks.get(runId);
    if (!cb) throw new Error(`run ${runId} 的 WebSocket 回调未注册`);
    act(() => cb(event));
  }

  it('发送消息 → 流式回复渲染 → 会话持久化', async () => {
    mockSubmitRequirement.mockResolvedValue({ run_id: 'run-flow', status: 'running', session_id: 'sess-1' });

    render(
      <TestProviders>
        <AgentStudioWorkstation />
      </TestProviders>,
    );

    await sendMessage('帮我实现一个冒泡排序');

    await waitFor(() => expect(messagesArea().textContent).toContain('帮我实现一个冒泡排序'));

    await waitFor(() => {
      expect(mockSubmitRequirement).toHaveBeenCalledWith('帮我实现一个冒泡排序', undefined, 'key-1', 'gpt-4', undefined, undefined, undefined);
    });

    await waitFor(() => expect(wsCallbacks.has('run-flow')).toBe(true));

    emitWs('run-flow', { type: 'stream', content: '好的，', agent_name: 'Agent' });
    emitWs('run-flow', { type: 'stream', content: '我来实现冒泡排序。', agent_name: 'Agent' });
    await waitFor(() => expect(messagesArea().textContent).toContain('好的，我来实现冒泡排序。'));

    await waitFor(() => expect(screen.getAllByText('帮我实现一个冒泡排序').length).toBeGreaterThanOrEqual(2));

    emitWs('run-flow', { type: 'result', run_id: 'run-flow', code: '' });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('agentstudio-conversations') || '[]');
      expect(saved).toHaveLength(1);
      expect(saved[0].sessionId).toBe('sess-1');
      expect(saved[0].messages.map((m: { content: string }) => m.content)).toEqual(['帮我实现一个冒泡排序', '好的，我来实现冒泡排序。']);
    });
  });

  it('新建对话 → 发送 → 切换会话后历史正确', async () => {
    mockSubmitRequirement.mockResolvedValue({ run_id: 'run-switch', status: 'running', session_id: 'sess-2' });
    seedConversations();

    render(
      <TestProviders>
        <AgentStudioWorkstation />
      </TestProviders>,
    );

    await waitFor(() => {
      const el = messagesArea();
      expect(el.textContent).toContain('对话A的用户消息');
      expect(el.textContent).toContain('对话A的回复');
    });

    fireEvent.click(screen.getByRole('button', { name: /新建对话/ }));
    await waitFor(() => expect(screen.getByPlaceholderText(/描述你的需求/)).toBeInTheDocument());
    expect(document.querySelector('main [aria-live="polite"]')).toBeNull();

    await sendMessage('第三段对话的消息');
    await waitFor(() => expect(messagesArea().textContent).toContain('第三段对话的消息'));
    await waitFor(() => expect(wsCallbacks.has('run-switch')).toBe(true));

    fireEvent.click(screen.getByText('第一段对话'));
    await waitFor(() => {
      const el = messagesArea();
      expect(el.textContent).toContain('对话A的用户消息');
      expect(el.textContent).toContain('对话A的回复');
      expect(el.textContent).not.toContain('第三段对话的消息');
    });

    fireEvent.click(screen.getByText('第二段对话'));
    await waitFor(() => {
      const el = messagesArea();
      expect(el.textContent).toContain('对话B的用户消息');
      expect(el.textContent).toContain('对话B的回复');
      expect(el.textContent).not.toContain('对话A的用户消息');
    });
  });

  it('提交失败时显示错误横幅与重试按钮', async () => {
    mockSubmitRequirement.mockRejectedValue(new Error('模拟网络错误'));

    render(
      <TestProviders>
        <AgentStudioWorkstation />
      </TestProviders>,
    );

    await sendMessage('这条消息会失败');

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('模拟网络错误');
      expect(alert.textContent).toContain('重试');
    });

    fireEvent.click(screen.getByText('重试'));
    await waitFor(() => expect(mockSubmitRequirement).toHaveBeenCalledTimes(2));
  });

  it('运行中切换会话 → 流式消息写回原会话而非新会话', async () => {
    mockSubmitRequirement.mockResolvedValue({ run_id: 'run-mid', status: 'running', session_id: 'sess-3' });
    seedConversations();

    render(
      <TestProviders>
        <AgentStudioWorkstation />
      </TestProviders>,
    );

    await waitFor(() => expect(messagesArea().textContent).toContain('对话A的用户消息'));

    await sendMessage('运行中的新消息');
    await waitFor(() => expect(wsCallbacks.has('run-mid')).toBe(true));

    emitWs('run-mid', { type: 'stream', content: '运行中的回复。', agent_name: 'Agent' });
    await waitFor(() => expect(messagesArea().textContent).toContain('运行中的回复。'));

    fireEvent.click(screen.getByText('第二段对话'));
    await waitFor(() => expect(messagesArea().textContent).toContain('对话B的用户消息'));

    emitWs('run-mid', { type: 'result', run_id: 'run-mid', code: '' });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('agentstudio-conversations') || '[]');
      const convA = saved.find((c: { id: string }) => c.id === 'conv-a');
      const convB = saved.find((c: { id: string }) => c.id === 'conv-b');
      expect(convA.messages.map((m: { content: string }) => m.content)).toContain('运行中的回复。');
      expect(convB.messages.map((m: { content: string }) => m.content)).not.toContain('运行中的回复。');
    });
  });

  it('团队 run 结束后按节点展示独立产物', async () => {
    mockSubmitRequirement.mockResolvedValue({ run_id: 'run-team', status: 'running', session_id: 'sess-team' });

    render(
      <TestProviders>
        <AgentStudioWorkstation />
      </TestProviders>,
    );

    await sendMessage('帮我设计一个登录页');

    await waitFor(() => expect(wsCallbacks.has('run-team')).toBe(true));

    emitWs('run-team', { type: 'thinking_stream', content: 'pm 正在拆解需求', agent_name: 'pm' });
    emitWs('run-team', { type: 'stream', content: '需求设计产出', agent_name: 'pm' });
    emitWs('run-team', { type: 'stream', content: '审查意见', agent_name: 'reviewer' });
    await waitFor(() => expect(messagesArea().textContent).toContain('需求设计产出'));

    emitWs('run-team', {
      type: 'team_result',
      status: 'completed',
      artifacts: { pm: '需求设计产出', reviewer: '审查意见' },
      display: '## pm\n\n需求设计产出\n\n---\n\n## reviewer\n\n审查意见',
    });

    await waitFor(() => {
      const el = messagesArea();
      expect(el.textContent).toContain('需求设计产出');
      expect(el.textContent).toContain('审查意见');
    });
  });
});
