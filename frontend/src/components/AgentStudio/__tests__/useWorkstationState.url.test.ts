import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Route, Routes } from 'react-router-dom';
const queryClient = new QueryClient();

// 复制 selection.test.ts 的 hoisted 骨架（mock 变量 + store 快照）。
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
  convActiveId,
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
    mockConvRef: { current: convArray },
    mockSessionsLoaded: { loaded: false },
    convActiveId: { current: null as string | null },
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
    get activeConvId() { return convActiveId.current; },
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

vi.mock('../../../api/client', () => ({
  get executeCommand() { return (..._args: unknown[]) => Promise.resolve(); },
}));

// getSessionDetail：URL 会话直开加载路径会调用（mock 会话带 sessionId），
// 不 mock 会发真实网络请求（测试不可控）。
vi.mock('../../../api/client/sessions', () => ({
  getSessionDetail: vi.fn(() => Promise.resolve({ runs: [] })),
  listSessions: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  pinSession: vi.fn(),
}));

vi.mock('../../../hooks/useAgentCommands', () => ({
  useAgentCommands: () => [],
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

// 支持 URL 参数的路由包裹：/chat/:sessionId 与 /agent/:agentId/:sessionId、
// /team/:teamId/:sessionId 全部挂到同一组件（真实 App.tsx 同构）。
function makeUrlWrapper(path: string) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/chat/:sessionId', element: children }),
          createElement(Route, { path: '/agent/:agentId/:sessionId', element: children }),
          createElement(Route, { path: '/team/:teamId/:sessionId', element: children }),
        ),
      ),
    );
}

describe('bug1: URL 三态身份标注', { tags: ['unit'] }, () => {
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
    convActiveId.current = null;
    mockSubmitRequirement.mockResolvedValue({});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('直开 /team/:tid/:sid → 同步恢复 activeTeamId', async () => {
    renderHook(
      () => useWorkstationState(createRef(), createRef(), createRef()),
      { wrapper: makeUrlWrapper('/team/team-1/sess-1') },
    );
    await act(async () => { vi.runAllTimers(); });
    expect(mockStoreSetActiveTeam).toHaveBeenCalledWith('team-1');
  });

  it('直开 /agent/:aid/:sid → 同步恢复 selectedAgentId（组件内 state，经渲染态断言）', async () => {
    const { result } = renderHook(
      () => useWorkstationState(createRef(), createRef(), createRef()),
      { wrapper: makeUrlWrapper('/agent/agent-1/sess-1') },
    );
    await act(async () => { vi.runAllTimers(); });
    expect(result.current.selectedAgentId).toBe('agent-1');
    // 未触发发送路径
    expect(mockSubmitRequirement).not.toHaveBeenCalled();
  });

  it('agent 会话续聊：submitToApi 携带会话自身 agentId（消除恢复竞态）', async () => {
    mockConversations.push({
      id: 'sess-1', sessionId: 'sess-1', title: 't', kind: 'agent',
      agentId: 'agent-1', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), temp: false,
    });
    convActiveId.current = 'sess-1';
    const { result } = renderHook(
      () => useWorkstationState(createRef(), createRef(), createRef()),
      { wrapper: makeUrlWrapper('/chat/sess-1') },
    );
    // 通过 hook 暴露的 handleSendMessage 触发发送（续聊分支：conv.activeConvId 命中）
    await act(async () => { await result.current.handleSendMessage('续聊', []); });
    expect(mockSubmitRequirement).toHaveBeenCalledWith(
      '续聊', undefined, 'agent-1', true, undefined, undefined, undefined, undefined,
    );
  });
});