import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Agent } from '../../../types/AgentStudio';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../modals/AgentConfigModal', () => ({
  default: ({ onSave: _onSave, onClose: _onClose }: { onSave: () => void; onClose: () => void }) =>
    <div data-testid="agent-config-modal">AgentConfigModal</div>,
}));
vi.mock('../modals/SettingsModal', () => ({
  default: ({ onClose: _onClose }: { onClose: () => void }) => <div data-testid="settings-modal">SettingsModal</div>,
}));
vi.mock('../modals/ApiManagementModal', () => ({
  default: ({ onClose: _onClose }: { onClose: () => void }) => <div data-testid="api-management-modal">ApiManagementModal</div>,
}));
vi.mock('../modals/ConfirmModal', () => ({
  default: ({ title, message, onConfirm: _onConfirm, onCancel: _onCancel, danger: _danger }: { title: string; message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) =>
    <div data-testid="confirm-modal">{title} - {message}</div>,
}));
vi.mock('../modals/NewProjectModal', () => ({
  default: ({ onClose: _onClose }: { onClose: () => void }) => <div data-testid="new-project-modal">NewProjectModal</div>,
}));

import Modals from '../Modals';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'a1',
    name: 'Dev Agent',
    role: 'Developer',
    icon: vi.fn(() => null) as unknown as Agent['icon'],
    color: '#334155',
    bg: '#f1f5f9',
    border: '#e2e8f0',
    ...overrides,
  };
}

describe('Modals', { tags: ['integration'] }, () => {
  const baseProps = {
    configuringAgent: null,
    isSettingsOpen: false,
    isApiOpen: false,
    confirmDialog: null,
    isNewProjectOpen: false,
    onCloseAgentConfig: vi.fn(),
    onSaveAgent: vi.fn(),
    onCloseSettings: vi.fn(),
    onCloseApi: vi.fn(),
    onCloseConfirm: vi.fn(),
    onCloseNewProject: vi.fn(),
  };

  it('renders nothing when all modals are closed', async () => {
    render(<Modals {...baseProps} />);
    // Wrapped in Suspense fallback=null — nothing visible
    await expect(screen.queryByTestId('agent-config-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('api-management-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-project-modal')).not.toBeInTheDocument();
  });

  it('renders AgentConfigModal when configuringAgent is provided', async () => {
    render(
      <Modals
        {...baseProps}
        configuringAgent={makeAgent()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('agent-config-modal')).toBeInTheDocument();
    });
  });

  it('renders SettingsModal when isSettingsOpen is true', async () => {
    render(<Modals {...baseProps} isSettingsOpen />);
    await waitFor(() => {
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    });
  });

  it('renders ApiManagementModal when isApiOpen is true', async () => {
    render(<Modals {...baseProps} isApiOpen />);
    await waitFor(() => {
      expect(screen.getByTestId('api-management-modal')).toBeInTheDocument();
    });
  });

  it('renders ConfirmModal when confirmDialog is provided', async () => {
    render(
      <Modals
        {...baseProps}
        confirmDialog={{ title: '确认删除', message: '确定要删除吗？', onConfirm: vi.fn() }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
    expect(screen.getByText(/确认删除/)).toBeInTheDocument();
  });

  it('renders NewProjectModal when isNewProjectOpen is true', async () => {
    render(<Modals {...baseProps} isNewProjectOpen />);
    await waitFor(() => {
      expect(screen.getByTestId('new-project-modal')).toBeInTheDocument();
    });
  });

  it('renders multiple modals simultaneously when multiple conditions are true', async () => {
    render(
      <Modals
        {...baseProps}
        configuringAgent={makeAgent({ name: 'Test', role: 'Assistant' })}
        isSettingsOpen
        isApiOpen
        confirmDialog={{ title: '确认', message: '确定？', onConfirm: vi.fn() }}
        isNewProjectOpen
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('agent-config-modal')).toBeInTheDocument();
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
      expect(screen.getByTestId('api-management-modal')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
      expect(screen.getByTestId('new-project-modal')).toBeInTheDocument();
    });
  });

  it('clears ConfirmModal when danger is set', async () => {
    render(
      <Modals
        {...baseProps}
        confirmDialog={{ title: '危险操作', message: '确认危险操作？', onConfirm: vi.fn(), danger: true }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument();
    });
  });
});
