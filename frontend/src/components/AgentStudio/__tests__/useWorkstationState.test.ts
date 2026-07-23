import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock all dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));

vi.mock('../../../utils/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../../../hooks/useTeamManagement', () => ({
  useTeamManagement: () => ({ teams: [], loading: false }),
}));

vi.mock('../../../hooks/useConversation', () => ({
  useConversation: () => ({
    conversations: [], activeConvId: null, switchConversation: vi.fn(), createConversation: vi.fn(),
  }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useNotificationSound: () => vi.fn(),
  useSettings: () => ({
    settings: { soundEnabled: false, theme: 'light', sendOnEnter: true },
    updateSettings: vi.fn(),
  }),
}));

vi.mock('../../../api/hooks', () => ({
  useAgents: () => vi.fn(),
  useAvailableModels: () => [],
  useCommands: () => ({ data: [] }),
}));

vi.mock('../../../api/client', () => ({
  executeCommand: vi.fn(),
}));

vi.mock('../../../hooks/useAgentCommands', () => ({
  useAgentCommands: () => [],
}));

vi.mock('../../../stores/chatStore', () => ({
  useChatStore: (selector?: (s: any) => any) => {
    const state = {
      messages: [], status: 'idle', error: null, wsStatus: 'disconnected',
      activeConvId: null, activeTeamId: null, isRunning: false, isThinking: false,
      reset: vi.fn(), cancelRun: vi.fn(), loadConversation: vi.fn(), lastAbandonedRunId: null,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../stores/chatActions', () => ({
  submitRequirement: vi.fn(),
  retry: vi.fn(),
}));

vi.mock('./useDragAndDrop', () => ({
  useDragAndDrop: () => ({ dragOver: false, handleDragOver: vi.fn(), handleDragLeave: vi.fn(), handleDrop: vi.fn() }),
}));

vi.mock('../../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { useWorkstationState } from '../useWorkstationState';

describe('useWorkstationState', () => {
  const createRef = () => ({ current: null } as React.RefObject<HTMLDivElement | null>);

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
});
