import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { mockSetIsSidebarOpen, mockUpdateSettings,
  mockHandleNewChat, mockResetApi, mockCancelRun, mockRetryApi,
  mockSetSelectedModel, mockSetWelcomeDismissed, mockSetIsApiOpen,
  mockHandleSendMessage, mockHandleHomeSend, mockHandleExecuteCommand,
  mockToggleWorkspaceFullscreen, mockSetActiveWorkspaceTab,
  mockHandlePageDragOver, mockHandlePageDragLeave, mockHandlePageDrop,
  mockHandleSaveAgent, mockHandleCloseAgentConfig, mockHandleCloseSettings,
  mockHandleCloseApi, mockHandleCloseConfirm, mockHandleCloseNewProject,
  mockSetSelectedAgentId, mockSetConfiguringAgent, mockSetIsUserMenuOpen,
  mockSetIsSettingsOpen, mockSetActiveConvId, mockSetConversations,
  mockToggleTeam, mockHandleAddTeam, mockHandleAddAgent,
  mockHandleDeleteTeam, mockHandleDeleteAgent,
  mockHandleRenameTeam, mockHandleRenameAgent, mockHandleTogglePinTeam,
  wsMock, storeOverride } = vi.hoisted(() => {

  const override: Record<string, unknown> = {};

  const ws = {
    WorkstationPage: vi.fn(() => null),
    AgentStudioSidebar: vi.fn(() => null),
    Workspace: vi.fn(() => null),
    Modals: vi.fn(() => null),
    HomeScreen: vi.fn(() => null),
    MessagesPanel: vi.fn(() => null),
    InputToolbar: vi.fn(() => null),
  };

  return {
    mockSetIsSidebarOpen: vi.fn(),
    mockUpdateSettings: vi.fn(),
    mockHandleNewChat: vi.fn(),
    mockResetApi: vi.fn(),
    mockCancelRun: vi.fn(),
    mockRetryApi: vi.fn(),
    mockSetSelectedModel: vi.fn(),
    mockSetWelcomeDismissed: vi.fn(),
    mockSetIsApiOpen: vi.fn(),
    mockHandleSendMessage: vi.fn(),
    mockHandleHomeSend: vi.fn(),
    mockHandleExecuteCommand: vi.fn(),
    mockToggleWorkspaceFullscreen: vi.fn(),
    mockSetActiveWorkspaceTab: vi.fn(),
    mockHandlePageDragOver: vi.fn(),
    mockHandlePageDragLeave: vi.fn(),
    mockHandlePageDrop: vi.fn(),
    mockHandleSaveAgent: vi.fn(),
    mockHandleCloseAgentConfig: vi.fn(),
    mockHandleCloseSettings: vi.fn(),
    mockHandleCloseApi: vi.fn(),
    mockHandleCloseConfirm: vi.fn(),
    mockHandleCloseNewProject: vi.fn(),
    mockSetSelectedAgentId: vi.fn(),
    mockSetConfiguringAgent: vi.fn(),
    mockSetIsUserMenuOpen: vi.fn(),
    mockSetIsSettingsOpen: vi.fn(),
    mockSetActiveConvId: vi.fn(),
    mockSetConversations: vi.fn(),
    mockToggleTeam: vi.fn(),
    mockHandleAddTeam: vi.fn(),
    mockHandleAddAgent: vi.fn(),
    mockHandleDeleteTeam: vi.fn(),
    mockHandleDeleteAgent: vi.fn(),
    mockHandleRenameTeam: vi.fn(),
    mockHandleRenameAgent: vi.fn(),
    mockHandleTogglePinTeam: vi.fn(),
    wsMock: ws,
    storeOverride: override,
  };
});

function defaultState() {
  return {
    t: (k: string) => k,
    isWorkstationOpen: false,
    isSidebarOpen: true,
    setIsSidebarOpen: mockSetIsSidebarOpen,
    isDarkMode: false,
    updateSettings: mockUpdateSettings,
    handleNewChat: mockHandleNewChat,
    resetApi: mockResetApi,
    cancelRun: mockCancelRun,
    retryApi: mockRetryApi,
    apiStatus: 'idle',
    apiError: null,
    wsStatus: 'connected',
    showAgentChat: false,
    hasMessages: false,
    selectedAgentId: null,
    activeTeamId: null,
    welcomeDismissed: false,
    allAgents: [],
    displayMessages: [],
    setWelcomeDismissed: mockSetWelcomeDismissed,
    conversationKey: 0,
    models: [],
    selectedModel: '',
    effectiveSelectedModel: '',
    setSelectedModel: mockSetSelectedModel,
    allCommands: [],
    handleHomeSend: mockHandleHomeSend,
    handleSendMessage: mockHandleSendMessage,
    handleExecuteCommand: mockHandleExecuteCommand,
    setIsApiOpen: mockSetIsApiOpen,
    isPageDragOver: false,
    handlePageDragOver: mockHandlePageDragOver,
    handlePageDragLeave: mockHandlePageDragLeave,
    handlePageDrop: mockHandlePageDrop,
    toggleWorkspaceFullscreen: mockToggleWorkspaceFullscreen,
    activeWorkspaceTab: 'code',
    setActiveWorkspaceTab: mockSetActiveWorkspaceTab,
    isWorkspaceOpen: false,
    setIsWorkspaceOpen: vi.fn(),
    configuringAgent: null,
    isSettingsOpen: false,
    isApiOpen: false,
    confirmDialog: null,
    isNewProjectOpen: false,
    handleCloseAgentConfig: mockHandleCloseAgentConfig,
    handleSaveAgent: mockHandleSaveAgent,
    handleCloseSettings: mockHandleCloseSettings,
    handleCloseApi: mockHandleCloseApi,
    handleCloseConfirm: mockHandleCloseConfirm,
    handleCloseNewProject: mockHandleCloseNewProject,
    setSelectedAgentId: mockSetSelectedAgentId,
    setConfiguringAgent: mockSetConfiguringAgent,
    setActiveConvId: mockSetActiveConvId,
    setConversations: mockSetConversations,
    isUserMenuOpen: false,
    setIsUserMenuOpen: mockSetIsUserMenuOpen,
    setIsSettingsOpen: mockSetIsSettingsOpen,
    teamMgmt: {
      teams: [],
      toggleTeam: mockToggleTeam,
      handleAddTeam: mockHandleAddTeam,
      handleAddAgent: mockHandleAddAgent,
      handleDeleteTeam: mockHandleDeleteTeam,
      handleDeleteAgent: mockHandleDeleteAgent,
      handleRename: mockHandleRenameTeam,
      handleRenameAgent: mockHandleRenameAgent,
      handleTogglePinTeam: mockHandleTogglePinTeam,
      allAgents: [],
      replaceAgentId: vi.fn(),
      linkMemberAgent: vi.fn(),
    },
    conv: {
      conversations: [],
      activeConvId: null,
      setActiveConvId: mockSetActiveConvId,
      setConversations: mockSetConversations,
      updateConversationMessages: vi.fn(),
      updateConversationSessionId: vi.fn(),
      saveConversation: vi.fn(),
    },
    filteredConversations: [],
    apiMessages: [],
    submitToApi: vi.fn(),
    loadConversation: vi.fn(),
    abandonedRunId: null,
    currentSessionId: null,
    toast: vi.fn(),
    notify: vi.fn(),
  };
}

vi.mock('../useWorkstationState', () => ({
  useWorkstationState: () => {
    const base = defaultState();
    return { ...base, ...storeOverride };
  },
}));

vi.mock('../WorkstationPage', () => ({ default: wsMock.WorkstationPage }));
vi.mock('../AgentStudioSidebar', () => ({ default: wsMock.AgentStudioSidebar }));
vi.mock('../workspace/Workspace', () => ({ default: wsMock.Workspace }));
vi.mock('../Modals', () => ({ default: wsMock.Modals }));
vi.mock('../HomeScreen', () => ({ default: wsMock.HomeScreen }));
vi.mock('../MessagesPanel', () => ({ default: wsMock.MessagesPanel }));
vi.mock('../../input', () => ({ InputToolbar: wsMock.InputToolbar }));

import AgentStudioWorkstation from '../AgentStudioWorkstation';

function resetStoreOverride() {
  const keys = Object.keys(storeOverride);
  for (const key of keys) {
    delete storeOverride[key];
  }
}

describe('AgentStudioWorkstation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStoreOverride();
  });

  it('renders without crashing', () => {
    const { container } = render(<AgentStudioWorkstation />);
    expect(container).toBeDefined();
  });

  it('renders the agentstudio-app container', () => {
    const { container } = render(<AgentStudioWorkstation />);
    expect(container.querySelector('.agentstudio-app')).toBeDefined();
  });

  it('renders Sidebar component', () => {
    render(<AgentStudioWorkstation />);
    expect(wsMock.AgentStudioSidebar).toHaveBeenCalled();
  });

  it('does not render WorkstationPage when isWorkstationOpen is false', () => {
    render(<AgentStudioWorkstation />);
    expect(wsMock.WorkstationPage).not.toHaveBeenCalled();
  });

  it('renders WorkstationPage when isWorkstationOpen is true', () => {
    storeOverride.isWorkstationOpen = true;
    render(<AgentStudioWorkstation />);
    expect(wsMock.WorkstationPage).toHaveBeenCalled();
  });

  it('renders header with toggle sidebar button', () => {
    render(<AgentStudioWorkstation />);
    expect(screen.getByLabelText('Toggle sidebar')).toBeInTheDocument();
  });

  it('renders dark mode toggle button', () => {
    render(<AgentStudioWorkstation />);
    expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
  });

  it('renders notifications button', () => {
    render(<AgentStudioWorkstation />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('renders HomeScreen when showAgentChat and hasMessages are false', () => {
    render(<AgentStudioWorkstation />);
    expect(wsMock.HomeScreen).toHaveBeenCalled();
    expect(wsMock.MessagesPanel).not.toHaveBeenCalled();
  });

  it('renders MessagesPanel when showAgentChat is true', () => {
    storeOverride.showAgentChat = true;
    storeOverride.selectedAgentId = 'agent-1';
    render(<AgentStudioWorkstation />);
    expect(wsMock.MessagesPanel).toHaveBeenCalled();
    expect(wsMock.HomeScreen).not.toHaveBeenCalled();
  });

  it('renders MessagesPanel when hasMessages is true', () => {
    storeOverride.hasMessages = true;
    render(<AgentStudioWorkstation />);
    expect(wsMock.MessagesPanel).toHaveBeenCalled();
    expect(wsMock.HomeScreen).not.toHaveBeenCalled();
  });

  it('renders InputToolbar when showAgentChat is true', () => {
    storeOverride.showAgentChat = true;
    storeOverride.selectedAgentId = 'agent-1';
    render(<AgentStudioWorkstation />);
    expect(wsMock.InputToolbar).toHaveBeenCalled();
  });

  it('renders InputToolbar when hasMessages is true', () => {
    storeOverride.hasMessages = true;
    render(<AgentStudioWorkstation />);
    expect(wsMock.InputToolbar).toHaveBeenCalled();
  });

  it('does not render InputToolbar when neither showAgentChat nor hasMessages', () => {
    render(<AgentStudioWorkstation />);
    expect(wsMock.InputToolbar).not.toHaveBeenCalled();
  });

  it('shows reconnecting banner when wsStatus is reconnecting', () => {
    storeOverride.wsStatus = 'reconnecting';
    render(<AgentStudioWorkstation />);
    expect(screen.getByText('common.connecting...')).toBeInTheDocument();
  });

  it('does not show reconnecting banner when wsStatus is connected', () => {
    render(<AgentStudioWorkstation />);
    expect(screen.queryByText('common.connecting...')).not.toBeInTheDocument();
  });

  it('shows error banner when apiStatus is error with apiError', () => {
    storeOverride.apiStatus = 'error';
    storeOverride.apiError = 'Test error message';
    render(<AgentStudioWorkstation />);
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('does not show error banner when apiStatus is not error', () => {
    storeOverride.apiStatus = 'idle';
    storeOverride.apiError = 'hidden error';
    render(<AgentStudioWorkstation />);
    expect(screen.queryByText('hidden error')).not.toBeInTheDocument();
  });

  it('renders Workspace component', () => {
    render(<AgentStudioWorkstation />);
    expect(wsMock.Workspace).toHaveBeenCalled();
  });

  it('renders Modals component', () => {
    render(<AgentStudioWorkstation />);
    expect(wsMock.Modals).toHaveBeenCalled();
  });

  it('passes correct props to Sidebar', () => {
    render(<AgentStudioWorkstation />);
    const call = wsMock.AgentStudioSidebar.mock.calls[0][0];
    expect(call).toHaveProperty('teams');
    expect(call).toHaveProperty('selectedAgentId');
    expect(call).toHaveProperty('conversations');
    expect(call).toHaveProperty('activeConvId');
    expect(call).toHaveProperty('isUserMenuOpen');
    expect(call).toHaveProperty('isSidebarOpen');
    expect(call).toHaveProperty('setIsUserMenuOpen');
    expect(call).toHaveProperty('setIsSettingsOpen');
    expect(call).toHaveProperty('onNewChat');
    expect(call).toHaveProperty('onOpenWorkstation');
  });

  it('passes selectedAgentId and activeTab to Workspace', () => {
    storeOverride.selectedAgentId = 'agent-1';
    storeOverride.activeWorkspaceTab = 'test';
    render(<AgentStudioWorkstation />);
    const call = wsMock.Workspace.mock.calls[0][0];
    expect(call.selectedAgentId).toBe('agent-1');
    expect(call.activeTab).toBe('test');
  });

  it('passes configuringAgent and modal open states to Modals', () => {
    render(<AgentStudioWorkstation />);
    const call = wsMock.Modals.mock.calls[0][0];
    expect(call).toHaveProperty('configuringAgent');
    expect(call).toHaveProperty('isSettingsOpen');
    expect(call).toHaveProperty('isApiOpen');
    expect(call).toHaveProperty('confirmDialog');
    expect(call).toHaveProperty('isNewProjectOpen');
  });

  it('does not render mobile overlay when sidebar is closed', () => {
    storeOverride.isSidebarOpen = false;
    render(<AgentStudioWorkstation />);
    expect(document.querySelector('.agentstudio-mobile-overlay')).toBeNull();
  });

  it('renders mobile overlay when sidebar is open', () => {
    storeOverride.isSidebarOpen = true;
    render(<AgentStudioWorkstation />);
    expect(document.querySelector('.agentstudio-mobile-overlay')).toBeDefined();
  });

  it('shows page drag overlay when isPageDragOver is true', () => {
    storeOverride.isPageDragOver = true;
    render(<AgentStudioWorkstation />);
    expect(screen.getByText('fileAttach.dropHere')).toBeInTheDocument();
  });

  it('passes isRunning=true to HomeScreen when apiStatus is loading', () => {
    storeOverride.apiStatus = 'loading';
    render(<AgentStudioWorkstation />);
    const call = wsMock.HomeScreen.mock.calls[0][0];
    expect(call.isRunning).toBe(true);
  });

  it('passes isRunning=false to HomeScreen when apiStatus is idle', () => {
    render(<AgentStudioWorkstation />);
    const call = wsMock.HomeScreen.mock.calls[0][0];
    expect(call.isRunning).toBe(false);
  });
});
