import { lazy, Suspense } from 'react';
import type { Agent } from '../../types/agentstudio';

const AgentConfigModal = lazy(() => import('./modals/AgentConfigModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));
const ApiManagementModal = lazy(() => import('./modals/ApiManagementModal'));
const ConfirmModal = lazy(() => import('./modals/ConfirmModal'));
const NewProjectModal = lazy(() => import('./modals/NewProjectModal'));

interface Props {
  configuringAgent: Agent | null;
  isSettingsOpen: boolean;
  isApiOpen: boolean;
  confirmDialog: { title: string; message: string; onConfirm: () => void; danger?: boolean } | null;
  isNewProjectOpen: boolean;
  onCloseAgentConfig: () => void;
  onSaveAgent: (agent: Agent) => void;
  onCloseSettings: () => void;
  onCloseApi: () => void;
  onCloseConfirm: () => void;
  onCloseNewProject: () => void;
}

export default function Modals({
  configuringAgent,
  isSettingsOpen,
  isApiOpen,
  confirmDialog,
  isNewProjectOpen,
  onCloseAgentConfig,
  onSaveAgent,
  onCloseSettings,
  onCloseApi,
  onCloseConfirm,
  onCloseNewProject,
}: Props) {
  return (
    <Suspense fallback={null}>
      {configuringAgent && (
        <AgentConfigModal agent={configuringAgent} onSave={onSaveAgent} onClose={onCloseAgentConfig} />
      )}
      {isSettingsOpen && <SettingsModal onClose={onCloseSettings} />}
      {isApiOpen && <ApiManagementModal onClose={onCloseApi} />}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={onCloseConfirm}
          danger={confirmDialog.danger}
        />
      )}
      {isNewProjectOpen && <NewProjectModal onClose={onCloseNewProject} onCreateProject={() => {}} />}
    </Suspense>
  );
}
