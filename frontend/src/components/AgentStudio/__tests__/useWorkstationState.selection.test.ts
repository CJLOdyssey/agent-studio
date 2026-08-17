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
    mockConversations: [] as unknown[],
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
    conversations: mockConversations,
    activeConvId: null,
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
