import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Route, Routes } from 'react-router-dom';
const queryClient = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(MemoryRouter, null, children),
  );

const {
  mockToast,
  mockSaveConversation,
  mockUpdateConversationMessages,
  mockSetActiveConvId,
  mockSetConversations,
  mockUpdateConversationSessionId,
  mockUpdateSettings,
  mockStoreReset,
  mockStoreCancelRun,
  mockStoreLoadConversation,
  mockStore,
  mockStoreSetActiveTeam,
  mockSubmitRequirement,
  mockRetry,
  mockConversations,
  mockConvRef,
  mockSessionsLoaded,
} = vi.hoisted(() => {
  const store = {
    messages: [] as unknown[],
    status: 'idle' as string,
    error: null as string | null,
    wsStatus: 'disconnected' as string,
    activeTeamId: null as string | null,
    abandonedRunId: null as string | null,
    currentSessionId: null as string | null,
  };
  const convArray = [] as unknown[];
  return {
    mockToast: vi.fn(),
    mockSaveConversation: vi.fn(),
    mockUpdateConversationMessages: vi.fn(),
    mockSetActiveConvId: vi.fn(),
    mockSetConversations: vi.fn(),
    mockUpdateConversationSessionId: vi.fn(),
    mockUpdateSettings: vi.fn(),
    mockStoreReset: vi.fn(),
    mockStoreCancelRun: vi.fn(),
    mockStoreLoadConversation: vi.fn(),
    mockStore: store,
    mockStoreSetActiveTeam: vi.fn(),
    mockSubmitRequirement: vi.fn(),
    mockRetry: vi.fn(),
    mockConversations: convArray,
    // useConversation 每次渲染返回 convArray 同一引用 → useMemo(filteredConversations)
    // 永远缓存 → 兜底 effect 的 filteredConversations dep 不变、从不重跑。真实
    // merge 会用新数组 setConversations；测试通过换引用复现"列表变化"。
    mockConvRef: { current: convArray },
    mockSessionsLoaded: { loaded: false },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));

vi.mock('../../../utils/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('../../../hooks/useTeamManagement', () => ({
  useTeamManagement: () => ({ teams: [], loading: false, allAgents: [] }),
}));

vi.mock('../../../hooks/useConversation', () => ({
  useConversation: () => ({
    conversations: mockConvRef.current,
    activeConvId: null,
    sessionsLoaded: mockSessionsLoaded.loaded,
    switchConversation: vi.fn(),
    createConversation: vi.fn(),
    saveConversation: mockSaveConversation,
    updateConversationMessages: mockUpdateConversationMessages,
    setActiveConvId: mockSetActiveConvId,
    setConversations: mockSetConversations,
    updateConversationSessionId: mockUpdateConversationSessionId,
  }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useNotificationSound: () => vi.fn(),
  useSettings: () => ({
    settings: { soundEnabled: false, theme: 'light', sendOnEnter: true },
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('../../../api/hooks', () => ({
  useAgents: () => vi.fn(),
  useAvailableModels: () => [{ id: 'model-a', name: 'Model A' }, { id: 'model-b', name: 'Model B' }],
  useCommands: () => ({ data: [] }),
}));

let commandCalledWith: string | null = null;
vi.mock('../../../api/client', () => ({
  get executeCommand() { return (...args: unknown[]) => { commandCalledWith = args[0] as string; return Promise.resolve(); }; },
}));

vi.mock('../../../hooks/useAgentCommands', () => ({
  useAgentCommands: () => [{ id: 'cmd-1', label: 'Cmd 1', type: 'action' }],
}));

vi.mock('../../../stores/chatStore', () => {
  const state = {
    get messages() { return mockStore.messages; },
    get status() { return mockStore.status; },
    get error() { return mockStore.error; },
    get wsStatus() { return mockStore.wsStatus; },
    activeConvId: null,
    get activeTeamId() { return mockStore.activeTeamId; },
    isRunning: false,
    isThinking: false,
    reset: mockStoreReset,
    cancelRun: mockStoreCancelRun,
    loadConversation: mockStoreLoadConversation,
    get lastAbandonedRunId() { return mockStore.abandonedRunId; },
    get currentSessionId() { return mockStore.currentSessionId; },
    setActiveTeam: mockStoreSetActiveTeam,
    clearMessages: vi.fn(),
  };
  const useChatStore = (selector?: (s: unknown) => unknown) =>
    selector ? selector(state) : state;
  useChatStore.getState = () => state;
  useChatStore.setState = vi.fn();
  return { useChatStore };
});

vi.mock('../../../stores/chatActions', () => ({
  submitRequirement: mockSubmitRequirement,
  retry: mockRetry,
}));

vi.mock('./useDragAndDrop', () => ({
  useDragAndDrop: () => ({
    isPageDragOver: false,
    handlePageDragOver: vi.fn(),
    handlePageDragLeave: vi.fn(),
    handlePageDrop: vi.fn(),
  }),
}));

vi.mock('../../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { useWorkstationState } from '../useWorkstationState';
import type * as React from 'react';

function createRef() {
  return { current: null } as React.RefObject<HTMLDivElement | null>;
}

describe('useWorkstationState', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.messages = [];
    mockStore.status = 'idle';
    mockStore.error = null;
    mockStore.wsStatus = 'disconnected';
    mockStore.activeTeamId = null;
    mockStore.abandonedRunId = null;
    mockStore.currentSessionId = null;
    mockConversations.length = 0;
  });

  describe('derived values', () => {
    it('hasMessages is false when apiMessages empty', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.hasMessages).toBe(false);
    });

    it('hasMessages is true with messages', () => {
      mockStore.messages = [{ id: '1', role: 'user', content: 'hi' }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.hasMessages).toBe(true);
    });

    it('showAgentChat false when both null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.showAgentChat).toBe(false);
    });

    it('showAgentChat true with selectedAgentId', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.setSelectedAgentId('agent-1'); });
      expect(result.current.showAgentChat).toBe(true);
    });

    it('showAgentChat true with activeTeamId', () => {
      mockStore.activeTeamId = 'team-1';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.showAgentChat).toBe(true);
    });

    it('isDarkMode false for light theme', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.isDarkMode).toBe(false);
    });

    it('effectiveSelectedModel uses selectedModel when set', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.setSelectedModel('model-b'); });
      expect(result.current.effectiveSelectedModel).toBe('model-b');
    });

    it('setSelectedModel persists to localStorage for key routing', () => {
      localStorage.removeItem('agentstudio-selected-model');
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.setSelectedModel('Qwen/Qwen3-8B'); });
      expect(localStorage.getItem('agentstudio-selected-model')).toBe('Qwen/Qwen3-8B');
    });

    it('initializes selectedModel from localStorage so refresh keeps the last pick', () => {
      localStorage.setItem('agentstudio-selected-model', 'model-a');
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.selectedModel).toBe('model-a');
      expect(result.current.effectiveSelectedModel).toBe('model-a');
    });

    it('ignores a stale localStorage model that no key provides', () => {
      localStorage.setItem('agentstudio-selected-model', 'retired-model');
      localStorage.removeItem('agentstudio-recent-models');
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.selectedModel).toBe('retired-model');
      expect(result.current.effectiveSelectedModel).toBe('');
    });

    it('effectiveSelectedModel is empty without selection or recent', () => {
      localStorage.removeItem('agentstudio-selected-model');
      localStorage.removeItem('agentstudio-recent-models');
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.effectiveSelectedModel).toBe('');
    });

    it('effectiveSelectedModel prefers most-recent-used model', () => {
      localStorage.removeItem('agentstudio-selected-model');
      localStorage.setItem('agentstudio-recent-models', JSON.stringify(['model-b', 'model-a']));
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.effectiveSelectedModel).toBe('model-b');
    });

    it('isPageDragOver defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.isPageDragOver).toBe(false);
    });

    it('apiError is null default', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.apiError).toBeNull();
    });

    it('apiError reflects store error', () => {
      mockStore.error = 'Something went wrong';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.apiError).toBe('Something went wrong');
    });

    it('allCommands merges api and agent commands', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.allCommands).toHaveLength(1);
    });

    it('displayMessages maps correctly', () => {
      mockStore.messages = [{ id: 'm1', role: 'user', content: 'hello', created_at: '2024-01-01T00:00:00Z' }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.displayMessages).toHaveLength(1);
      expect(result.current.displayMessages[0].id).toBe('m1');
      expect(result.current.displayMessages[0].role).toBe('user');
    });

    it('displayMessages handles missing created_at', () => {
      mockStore.messages = [{ id: 'm2', role: 'agent', content: 'hello', created_at: undefined }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.displayMessages[0].timestamp).toBe(0);
    });

    it('displayMessages handles agent role with agentId', () => {
      mockStore.messages = [{ id: 'm3', role: 'agent', content: 'response', created_at: '2024-01-01T00:00:00Z' }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.displayMessages[0].agentId).toBe('agent');
    });

    it('activeTeamName is undefined when no activeTeamId', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.activeTeamName).toBeUndefined();
    });

    it('wsStatus reflects store status', () => {
      mockStore.wsStatus = 'connected';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.wsStatus).toBe('connected');
    });

    it('abandonedRunId is null by default', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.abandonedRunId).toBeNull();
    });

    it('confirmDialog is null by default', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(result.current.confirmDialog).toBeNull();
    });
  });

  describe('URL 直开/刷新恢复会话身份', () => {
    const urlWrapper = (entries: string[]) =>
      ({ children }: { children: ReactNode }) =>
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            MemoryRouter,
            { initialEntries: entries },
            createElement(
              Routes,
              null,
              createElement(Route, { path: '/chat/:sessionId', element: children }),
            ),
          ),
        );

    function makeConv(id: string, overrides: Record<string, unknown> = {}) {
      return {
        id,
        title: 'T',
        messages: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        ...overrides,
      };
    }

    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('restores selectedAgentId for agent-kind conversation opened directly by URL', () => {
      mockConversations.push(makeConv('conv-a', { kind: 'agent', agentId: 'agent-1' }));
      const { result } = renderHook(
        () => useWorkstationState(createRef(), createRef(), createRef()),
        { wrapper: urlWrapper(['/chat/conv-a']) },
      );
      act(() => { vi.runAllTimers(); });
      expect(result.current.selectedAgentId).toBe('agent-1');
    });

    it('restores activeTeamId for team-kind conversation opened directly by URL', () => {
      mockConversations.push(makeConv('conv-t', { kind: 'team', teamId: 'team-9' }));
      renderHook(
        () => useWorkstationState(createRef(), createRef(), createRef()),
        { wrapper: urlWrapper(['/chat/conv-t']) },
      );
      act(() => { vi.runAllTimers(); });
      expect(mockStoreSetActiveTeam).toHaveBeenCalledWith('team-9');
    });

    it('clears team identity for normal-kind conversation opened directly by URL', () => {
      mockStore.activeTeamId = 'team-9';
      mockConversations.push(makeConv('conv-n', { kind: 'normal' }));
      const { result } = renderHook(
        () => useWorkstationState(createRef(), createRef(), createRef()),
        { wrapper: urlWrapper(['/chat/conv-n']) },
      );
      act(() => { vi.runAllTimers(); });
      expect(result.current.selectedAgentId).toBeNull();
      expect(mockStoreSetActiveTeam).toHaveBeenCalledWith(null);
    });
  });

  describe('callback functions', () => {
    it('handleNewChat resets api and clears selection', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.handleNewChat(); });
      expect(mockStoreReset).toHaveBeenCalled();
    });

    it('handleCloseAgentConfig sets configuringAgent to null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.handleCloseAgentConfig(); });
      expect(result.current.configuringAgent).toBeNull();
    });

    it('handleCloseSettings sets false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.setIsSettingsOpen(true); });
      act(() => { result.current.handleCloseSettings(); });
      expect(result.current.isSettingsOpen).toBe(false);
    });

    it('handleCloseApi sets false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.setIsApiOpen(true); });
      act(() => { result.current.handleCloseApi(); });
      expect(result.current.isApiOpen).toBe(false);
    });

    it('handleCloseConfirm sets null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.handleCloseConfirm(); });
      expect(result.current.confirmDialog).toBeNull();
    });

    it('handleCloseNewProject sets false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      act(() => { result.current.handleCloseNewProject(); });
      expect(result.current.isNewProjectOpen).toBe(false);
    });

    it('retryApi is a function', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(typeof result.current.retryApi).toBe('function');
    });

    it('cancelRun is a function', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(typeof result.current.cancelRun).toBe('function');
    });

    it('resetApi is a function', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(typeof result.current.resetApi).toBe('function');
    });
  });

  describe('abandoned run toast', () => {
    it('shows toast when abandonedRunId is set', () => {
      mockStore.abandonedRunId = 'run-123';
      renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      expect(mockToast).toHaveBeenCalledWith('toast.requestAbandoned', 'info');
    });
  });

  describe('handleExecuteCommand', () => {
    it('calls executeCommand with command id', async () => {
      mockStore.currentSessionId = 'sess-1';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      await act(async () => { await result.current.handleExecuteCommand('cmd-1'); });
      expect(commandCalledWith).toBe('cmd-1');
    });
  });

  describe('setConfirmDialog and handleCloseConfirm', () => {
    it('sets and clears confirmDialog', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()), { wrapper });
      const dialog = { title: '确认删除', message: '确定要删除吗？', onConfirm: vi.fn() };
      act(() => { result.current.setConfirmDialog(dialog); });
      expect(result.current.confirmDialog).toEqual(dialog);
      act(() => { result.current.handleCloseConfirm(); });
      expect(result.current.confirmDialog).toBeNull();
    });
  });
});

describe('bug3: URL 直开无缓存 → 列表到达后补触发加载', { tags: ['unit'] }, () => {
  const urlWrapper = (entries: string[]) =>
    ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: entries },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/chat/:sessionId', element: children }),
          ),
        ),
      );

  it('sessionsLoaded 翻转后重新触发加载 effect，命中会话并加载详情', async () => {
    mockConversations.length = 0;
    mockStoreLoadConversation.mockClear();
    const conv = {
      id: 's1',
      title: 't',
      kind: 'normal' as const,
      messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: Date.now() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      temp: false,
    };
    renderHook(
      () => useWorkstationState(createRef(), createRef(), createRef()),
      { wrapper: urlWrapper(['/chat/s1']) },
    );
    await act(async () => {
      // 首次 effect 的 setTimeout(0) 先行执行：此时列表仍空 → found 落空返回
      await new Promise((r) => setTimeout(r, 50));
      expect(mockStoreLoadConversation).not.toHaveBeenCalled();
      // 列表到达 + sessionsLoaded 翻转 → 仅当 deps 含 sessionsLoaded 才补触发
      mockConversations.push(conv);
      mockSessionsLoaded.loaded = true;
      await new Promise((r) => setTimeout(r, 50));
    });
    // deps 变化后的 effect 重跑在 act 结束后才 flush，其加载逻辑在 setTimeout(0) 中：
    // 断言前必须真实等待 timer 执行（对照实验：不加此等待则同步断言必失败）
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockStoreLoadConversation).toHaveBeenCalled();
  });
});

describe('次要: temp 发送中不被兜底踢回首页', { tags: ['unit'] }, () => {
  const urlWrapper = (entries: string[]) =>
    ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: entries },
          createElement(
            Routes,
            null,
            createElement(Route, { path: '/chat/:sessionId', element: children }),
            // 真实应用 '/' 与 '/chat/:id' 同组件（navigate 不卸载）：兜底误判
            // 跳回首页后组件保持挂载、sessionId 置 undefined → 加载 effect
            // reset()。无 catch-all 时 navigate 直接卸载，mockStoreReset 无信号。
            createElement(Route, { path: '*', element: children }),
          ),
        ),
      );

  it('发送中（run 在飞）temp 占位不被兜底踢回', async () => {
    mockConversations.length = 0;
    mockSessionsLoaded.loaded = true;
    mockStore.messages = [];
    mockStore.status = 'running';
    mockStore.currentSessionId = null;
    mockStoreReset.mockClear();
    // 复现真实时序（对齐 bug3 实证结构）：发送中 temp 占位在列表中（load effect
    // 的 tempFound 早退，不重置），随后 merge 吸附窗口未匹配以新数组移除占位 →
    // 兜底因 filteredConversations 引用变化重跑 → 占位已不在列表，仅凭
    // apiStatus='running'（run 在飞）判定为合法状态，不得误判"会话不存在"跳回首页。
    mockConversations.push({
      id: 'temp-abc',
      title: 'T',
      kind: 'normal',
      messages: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      temp: true,
    });
    renderHook(
      () => useWorkstationState(createRef(), createRef(), createRef()),
      { wrapper: urlWrapper(['/chat/temp-abc']) },
    );
    await act(async () => {
      // 首次 effect 的 setTimeout(0) 先行执行：temp 在列表 → tempFound 早退
      //（setRestoring(false)，延迟渲染挂起）
      await new Promise((r) => setTimeout(r, 50));
      // merge 以新数组引用移除占位 → 挂起的渲染 flush 时读到新数组 → 兜底重跑
      mockConvRef.current = [];
      await new Promise((r) => setTimeout(r, 50));
    });
    // deps 变化后的 effect 重跑在 act 结束后才 flush：断言前必须真实等待
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // 放行路径不导航、不重置；误判路径会 navigate('/') → activeConvId 置
    // undefined → 加载 effect reset()。
    expect(mockStoreReset).not.toHaveBeenCalled();
    // 用例结尾复位，防后续污染（reviewer Minor ①）
    mockStore.status = 'idle';
    mockConvRef.current = mockConversations;
  });

  it('陈旧 temp URL（列表无 temp + idle）仍被兜底踢回', async () => {
    mockConversations.length = 0;
    mockSessionsLoaded.loaded = true;
    mockStore.messages = [];
    mockStore.status = 'idle';
    mockStore.currentSessionId = null;
    mockStoreReset.mockClear();
    // 陈旧 temp URL：temp 不落盘，刷新/直开时列表无此会话且无 run 在飞
    // （idle）→ 兜底恢复生效，navigate('/') → 加载 effect reset()。
    renderHook(
      () => useWorkstationState(createRef(), createRef(), createRef()),
      { wrapper: urlWrapper(['/chat/temp-abc']) },
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockStoreReset).toHaveBeenCalled();
    // 用例结尾复位，防后续污染（reviewer Minor ①）
    mockStore.status = 'idle';
    mockConvRef.current = mockConversations;
  });
});
