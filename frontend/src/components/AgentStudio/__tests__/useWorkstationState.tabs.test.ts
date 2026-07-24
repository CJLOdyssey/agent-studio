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

const commandCalledWith: string[] = [];
vi.mock('../../../api/client', () => ({
  get executeCommand() { return (...args: unknown[]) => { commandCalledWith.push(args[0] as string); return Promise.resolve(); }; },
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

describe('useWorkstationState', () => {
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
});
