import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const {
  mockToast,
  mockSaveConversation,
  mockUpdateConversationMessages,
  mockSetActiveConvId,
  mockSetConversations,
  mockUpdateConversationSessionId,
  mockUpdateSettings,
  mockExecuteCommand,
  mockStoreReset,
  mockStoreCancelRun,
  mockStoreLoadConversation,
  mockStore,
  mockStoreSetActiveTeam,
  mockSubmitRequirement,
  mockRetry,
} = vi.hoisted(() => {
  const store = {
    messages: [] as any[],
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
    mockExecuteCommand: vi.fn(),
    mockStoreReset: vi.fn(),
    mockStoreCancelRun: vi.fn(),
    mockStoreLoadConversation: vi.fn(),
    mockStore: store,
    mockStoreSetActiveTeam: vi.fn(),
    mockSubmitRequirement: vi.fn(),
    mockRetry: vi.fn(),
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
    conversations: [],
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

vi.mock('../../../stores/chatStore', () => ({
  useChatStore: (selector?: (s: any) => any) => {
    const state = {
      messages: mockStore.messages,
      status: mockStore.status,
      error: mockStore.error,
      wsStatus: mockStore.wsStatus,
      activeConvId: null,
      activeTeamId: mockStore.activeTeamId,
      isRunning: false,
      isThinking: false,
      reset: mockStoreReset,
      cancelRun: mockStoreCancelRun,
      loadConversation: mockStoreLoadConversation,
      lastAbandonedRunId: mockStore.abandonedRunId,
      currentSessionId: mockStore.currentSessionId,
      getState: () => state,
      setActiveTeam: mockStoreSetActiveTeam,
    };
    return selector ? selector(state) : state;
  },
}));

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
  });

  it('initializes without crashing', () => {
    const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
    expect(result.current).toBeDefined();
    expect(typeof result.current.submitToApi).toBe('function');
  });

  it('provides expected API surface', () => {
    const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
    expect(typeof result.current.submitToApi).toBe('function');
    expect(typeof result.current.retryApi).toBe('function');
    expect(typeof result.current.cancelRun).toBe('function');
    expect(typeof result.current.resetApi).toBe('function');
    expect(Array.isArray(result.current.apiMessages)).toBe(true);
  });

  describe('initial state values', () => {
    it('isSidebarOpen defaults to true', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isSidebarOpen).toBe(true);
    });

    it('welcomeDismissed defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.welcomeDismissed).toBe(false);
    });

    it('isWorkspaceOpen defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isWorkspaceOpen).toBe(false);
    });

    it('isWorkstationOpen defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isWorkstationOpen).toBe(false);
    });

    it('selectedAgentId defaults to null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.selectedAgentId).toBeNull();
    });

    it('configuringAgent defaults to null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.configuringAgent).toBeNull();
    });

    it('isUserMenuOpen defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isUserMenuOpen).toBe(false);
    });

    it('isSettingsOpen defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isSettingsOpen).toBe(false);
    });

    it('isApiOpen defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isApiOpen).toBe(false);
    });

    it('conversationKey defaults to 0', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.conversationKey).toBe(0);
    });

    it('activeWorkspaceTab defaults to "code"', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.activeWorkspaceTab).toBe('code');
    });

    it('selectedModel defaults to empty string', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.selectedModel).toBe('');
    });
  });

  describe('derived values', () => {
    it('hasMessages is false when apiMessages empty', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.hasMessages).toBe(false);
    });

    it('hasMessages is true with messages', () => {
      mockStore.messages = [{ id: '1', role: 'user', content: 'hi' }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.hasMessages).toBe(true);
    });

    it('showAgentChat false when both null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.showAgentChat).toBe(false);
    });

    it('showAgentChat true with selectedAgentId', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setSelectedAgentId('agent-1'); });
      expect(result.current.showAgentChat).toBe(true);
    });

    it('showAgentChat true with activeTeamId', () => {
      mockStore.activeTeamId = 'team-1';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.showAgentChat).toBe(true);
    });

    it('isDarkMode false for light theme', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isDarkMode).toBe(false);
    });

    it('effectiveSelectedModel uses selectedModel when set', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setSelectedModel('custom-model'); });
      expect(result.current.effectiveSelectedModel).toBe('custom-model');
    });

    it('effectiveSelectedModel falls back to first model', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.effectiveSelectedModel).toBe('model-a');
    });

    it('isPageDragOver defaults to false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.isPageDragOver).toBe(false);
    });

    it('apiError is null default', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.apiError).toBeNull();
    });

    it('apiError reflects store error', () => {
      mockStore.error = 'Something went wrong';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.apiError).toBe('Something went wrong');
    });

    it('allCommands merges api and agent commands', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.allCommands).toHaveLength(1);
    });

    it('displayMessages maps correctly', () => {
      mockStore.messages = [{ id: 'm1', role: 'user', content: 'hello', created_at: '2024-01-01T00:00:00Z' }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.displayMessages).toHaveLength(1);
      expect(result.current.displayMessages[0].id).toBe('m1');
      expect(result.current.displayMessages[0].role).toBe('user');
    });

    // ── Additional branch coverage ──

    it('displayMessages handles missing created_at', () => {
      mockStore.messages = [{ id: 'm2', role: 'agent', content: 'hello', created_at: undefined }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.displayMessages[0].timestamp).toBe(0);
    });

    it('displayMessages handles agent role with agentId', () => {
      mockStore.messages = [{ id: 'm3', role: 'agent', content: 'response', created_at: '2024-01-01T00:00:00Z' }];
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.displayMessages[0].agentId).toBe('agent');
    });

    it('activeTeamName is undefined when no activeTeamId', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.activeTeamName).toBeUndefined();
    });

    it('wsStatus reflects store status', () => {
      mockStore.wsStatus = 'connected';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.wsStatus).toBe('connected');
    });

    it('abandonedRunId is null by default', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.abandonedRunId).toBeNull();
    });

    it('confirmDialog is null by default', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(result.current.confirmDialog).toBeNull();
    });
  });

  describe('state setters', () => {
    it('setIsSidebarOpen toggles', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsSidebarOpen(false); });
      expect(result.current.isSidebarOpen).toBe(false);
    });

    it('setWelcomeDismissed sets true', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setWelcomeDismissed(true); });
      expect(result.current.welcomeDismissed).toBe(true);
    });

    it('setIsWorkspaceOpen toggles', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsWorkspaceOpen(true); });
      expect(result.current.isWorkspaceOpen).toBe(true);
    });

    it('setIsWorkstationOpen toggles', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsWorkstationOpen(true); });
      expect(result.current.isWorkstationOpen).toBe(true);
    });

    it('setActiveWorkspaceTab changes tab', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setActiveWorkspaceTab('test'); });
      expect(result.current.activeWorkspaceTab).toBe('test');
    });

    it('setIsUserMenuOpen toggles', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsUserMenuOpen(true); });
      expect(result.current.isUserMenuOpen).toBe(true);
    });

    it('setIsSettingsOpen opens', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsSettingsOpen(true); });
      expect(result.current.isSettingsOpen).toBe(true);
    });

    it('setIsApiOpen opens', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsApiOpen(true); });
      expect(result.current.isApiOpen).toBe(true);
    });

    it('setIsNewProjectOpen toggles', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsNewProjectOpen(true); });
      expect(result.current.isNewProjectOpen).toBe(true);
    });

    it('setConfirmDialog sets dialog state', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      const dialog = { title: 'Confirm', message: 'Are you sure?', onConfirm: vi.fn() };
      act(() => { result.current.setConfirmDialog(dialog); });
      expect(result.current.confirmDialog).toEqual(dialog);
    });

    it('setConversationKey increments key', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setConversationKey(5); });
      expect(result.current.conversationKey).toBe(5);
    });
  });

  describe('callback functions', () => {
    it('handleNewChat resets api and clears selection', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.handleNewChat(); });
      expect(mockStoreReset).toHaveBeenCalled();
    });

    it('handleCloseAgentConfig sets configuringAgent to null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.handleCloseAgentConfig(); });
      expect(result.current.configuringAgent).toBeNull();
    });

    it('handleCloseSettings sets false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsSettingsOpen(true); });
      act(() => { result.current.handleCloseSettings(); });
      expect(result.current.isSettingsOpen).toBe(false);
    });

    it('handleCloseApi sets false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.setIsApiOpen(true); });
      act(() => { result.current.handleCloseApi(); });
      expect(result.current.isApiOpen).toBe(false);
    });

    it('handleCloseConfirm sets null', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.handleCloseConfirm(); });
      expect(result.current.confirmDialog).toBeNull();
    });

    it('handleCloseNewProject sets false', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      act(() => { result.current.handleCloseNewProject(); });
      expect(result.current.isNewProjectOpen).toBe(false);
    });

    it('retryApi is a function', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(typeof result.current.retryApi).toBe('function');
    });

    it('cancelRun is a function', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(typeof result.current.cancelRun).toBe('function');
    });

    it('resetApi is a function', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(typeof result.current.resetApi).toBe('function');
    });
  });

  describe('abandoned run toast', () => {
    it('shows toast when abandonedRunId is set', () => {
      mockStore.abandonedRunId = 'run-123';
      renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      expect(mockToast).toHaveBeenCalledWith('toast.requestAbandoned', 'info');
    });
  });

  describe('handleExecuteCommand', () => {
    it('calls executeCommand with command id', async () => {
      mockStore.currentSessionId = 'sess-1';
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      await act(async () => { await result.current.handleExecuteCommand('cmd-1'); });
      expect(commandCalledWith).toBe('cmd-1');
    });
  });

  describe('setConfirmDialog and handleCloseConfirm', () => {
    it('sets and clears confirmDialog', () => {
      const { result } = renderHook(() => useWorkstationState(createRef(), createRef(), createRef()));
      const dialog = { title: '确认删除', message: '确定要删除吗？', onConfirm: vi.fn() };
      act(() => { result.current.setConfirmDialog(dialog); });
      expect(result.current.confirmDialog).toEqual(dialog);
      act(() => { result.current.handleCloseConfirm(); });
      expect(result.current.confirmDialog).toBeNull();
    });
  });
});
